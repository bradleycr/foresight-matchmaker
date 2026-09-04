import { z } from "zod"
import {
  KIND,
  ORG_TYPE,
  LANGUAGE,
  LOOKING_FOR,
  ATTENDING,
  APPLICATION_STATUS,
  METHODS,
  APPLICATION_TARGET,
  DISEASE_AREA,
  CLINICAL_PARTNER,
  REGULATORY_EXPERIENCE,
  COMPUTE,
  PRIVACY_CAPABILITY,
  TEAM_SIZE,
  MODALITY,
  N_SUBJECTS,
  VOLUME,
  ANNOTATION,
  LINKAGE,
  STANDARDS,
  READINESS,
  CONSENT_BASIS,
  ACCESS_MODEL,
  ETHICS_APPROVAL,
  YES_NO_UNSURE,
} from "@rmm/schema"
import { complete } from "./client"
import { extractJsonObject } from "./json"
import { parseUrlLines, tryNormalizeUrl } from "@/lib/normalize-url"
import { sanitizeProposal } from "./sanitize-proposal"

/**
 * Schema-first profile extraction — the single structured-output path.
 *
 * Chat (Remmy) collects facts; this module maps prose → PrefillProposal.
 * Output is validated with a tolerant Zod schema; invalid enum values are
 * dropped, never fatal. Nothing is published until the human submits the form.
 */

function loose<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values).optional().catch(undefined)
}

function looseArray<T extends readonly [string, ...string[]]>(values: T) {
  const allowed = new Set<string>(values)
  return z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.has(x)) : []),
    z.array(z.enum(values)),
  ).catch([])
}

function looseString(max: number) {
  return z.preprocess(
    (v) => (typeof v === "string" ? v.slice(0, max) : undefined),
    z.string().optional(),
  ).catch(undefined)
}

const datasetProposalSchema = z.object({
  name: looseString(160),
  modality: looseArray(MODALITY),
  modality_other: looseString(200),
  disease_area: looseArray(DISEASE_AREA),
  disease_area_other: looseString(200),
  n_subjects: loose(N_SUBJECTS),
  volume: loose(VOLUME),
  longitudinal: z.boolean().optional().catch(undefined),
  annotation: loose(ANNOTATION),
  linkage: looseArray(LINKAGE),
  standards: looseArray(STANDARDS),
  readiness: loose(READINESS),
  consent_basis: loose(CONSENT_BASIS),
  access_model: loose(ACCESS_MODEL),
  data_can_leave_institution: loose(YES_NO_UNSURE),
  ethics_approval: loose(ETHICS_APPROVAL),
})

export const prefillProposalSchema = z.object({
  kind: loose(KIND),
  org_name: looseString(200),
  org_type: loose(ORG_TYPE),
  country: z.preprocess(
    (v) => (typeof v === "string" && /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : undefined),
    z.string().optional(),
  ).catch(undefined),
  one_liner: looseString(140),
  summary: looseString(600),
  website: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined
      return tryNormalizeUrl(v) ?? undefined
    },
    z.string().url().optional(),
  ).catch(undefined),
  languages: looseArray(LANGUAGE),
  looking_for: looseArray(LOOKING_FOR),
  looking_for_other: looseString(200),
  still_seeking: looseArray(LOOKING_FOR),
  attending: looseArray(ATTENDING),
  application_status: loose(APPLICATION_STATUS),
  affiliation: looseString(200),
  methods: looseArray(METHODS),
  methods_other: looseString(200),
  org_type_other: looseString(200),
  application_target: looseArray(APPLICATION_TARGET),
  domain_expertise: looseArray(DISEASE_AREA),
  clinical_partner: loose(CLINICAL_PARTNER),
  regulatory_experience: looseArray(REGULATORY_EXPERIENCE),
  compute: loose(COMPUTE),
  compute_scale: looseString(120),
  privacy_capability: looseArray(PRIVACY_CAPABILITY),
  team_size: loose(TEAM_SIZE),
  intended_public_contribution: looseString(600),
  funding_mainly_needed_for: looseString(200),
  best_public_dataset: looseString(400),
  track_record: z.preprocess(
    (v) => {
      if (!Array.isArray(v)) return []
      return parseUrlLines(v.filter((x): x is string => typeof x === "string").join("\n"), 5).urls
    },
    z.array(z.string()),
  ).catch([]),
  data_needs: z
    .object({
      modality: looseArray(MODALITY),
      modality_other: looseString(200),
      disease_area: looseArray(DISEASE_AREA),
      disease_area_other: looseString(200),
      min_n_subjects: loose(N_SUBJECTS),
      annotation_required: loose(ANNOTATION),
      linkage_required: looseArray(LINKAGE),
      standards_preferred: looseArray(STANDARDS),
    })
    .optional()
    .catch(undefined),
  datasets: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, 5) : []),
    z.array(datasetProposalSchema),
  ).catch([]),
})

export type PrefillProposal = z.infer<typeof prefillProposalSchema>

/** A valid empty draft plus any fields the caller already knows (e.g. a website). */
export function blankProposal(partial: Partial<PrefillProposal> = {}): PrefillProposal {
  return prefillProposalSchema.parse(partial)
}

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
}

function takeOtherText(existing: unknown, extras: string[]): string | undefined {
  if (typeof existing === "string" && existing.trim()) return existing.trim().slice(0, 200)
  const joined = extras.map((s) => s.trim()).filter(Boolean).join("; ")
  return joined ? joined.slice(0, 200) : undefined
}

/** Map unknown vocab strings onto `other` + the matching please-define field. */
function coerceVocabArray(
  raw: unknown,
  allowed: readonly string[],
): { values: string[]; extras: string[] } {
  const allowedSet = new Set(allowed)
  const values: string[] = []
  const extras: string[] = []
  for (const item of asStringList(raw)) {
    if (allowedSet.has(item)) {
      if (!values.includes(item)) values.push(item)
    } else {
      extras.push(item)
    }
  }
  if (extras.length > 0 && allowedSet.has("other") && !values.includes("other")) {
    values.push("other")
  }
  return { values, extras }
}

/**
 * The extractor sometimes returns a free-text method / looking-for / org type
 * as if it were an enum. Keep the person's words instead of dropping them.
 */
export function coerceUnknownOtherFields(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw
  const o = { ...(raw as Record<string, unknown>) }

  const methods = coerceVocabArray(o.methods, METHODS)
  const methodsOther = takeOtherText(o.methods_other, methods.extras)
  if (methods.values.length) o.methods = methods.values
  if (methodsOther) {
    o.methods_other = methodsOther
    if (!methods.values.includes("other")) o.methods = [...methods.values, "other"]
  }

  const looking = coerceVocabArray(o.looking_for, LOOKING_FOR)
  const seeking = coerceVocabArray(o.still_seeking, LOOKING_FOR)
  const lookingOther = takeOtherText(o.looking_for_other, [...looking.extras, ...seeking.extras])
  if (looking.values.length) o.looking_for = looking.values
  if (seeking.values.length) o.still_seeking = seeking.values
  if (lookingOther) {
    o.looking_for_other = lookingOther
    const hasOther = looking.values.includes("other") || seeking.values.includes("other")
    if (!hasOther) o.looking_for = [...looking.values, "other"]
  }

  if (typeof o.org_type === "string" && o.org_type.trim() && !(ORG_TYPE as readonly string[]).includes(o.org_type)) {
    o.org_type_other = takeOtherText(o.org_type_other, [o.org_type])
    o.org_type = "other"
  } else if (typeof o.org_type_other === "string" && o.org_type_other.trim() && o.org_type !== "individual") {
    o.org_type = "other"
  }

  return o
}

const EXTRACT_SYSTEM_PROMPT = `You extract a structured organisation profile from free text, for a directory pairing European health-data holders with AI/ML teams.

Return ONLY a JSON object matching the profile schema. Include a field ONLY when the text clearly supports it — omit anything uncertain. Never invent contact details, subject counts, or ethics status. Never return contact_name, contact_email, or contact_role.

Allowed enum values (use EXACT strings):
kind: ${KIND.join(", ")}
org_type: ${ORG_TYPE.join(", ")}
country: ISO 3166-1 alpha-2 (e.g. DE, FR)
languages[]: ${LANGUAGE.join(", ")}
looking_for[]: ${LOOKING_FOR.join(", ")}
looking_for_other (required when looking_for or still_seeking includes other)
still_seeking[] (consortia): ${LOOKING_FOR.join(", ")}
attending[]: ${ATTENDING.join(", ")}
application_status: ${APPLICATION_STATUS.join(", ")}
methods[]: ${METHODS.join(", ")}
methods_other (required when methods includes other)
org_type_other (required when org_type is other)
application_target[]: ${APPLICATION_TARGET.join(", ")}
domain_expertise[] / disease_area[]: ${DISEASE_AREA.join(", ")}
clinical_partner: ${CLINICAL_PARTNER.join(", ")}
regulatory_experience[]: ${REGULATORY_EXPERIENCE.join(", ")}
compute: ${COMPUTE.join(", ")}
privacy_capability[]: ${PRIVACY_CAPABILITY.join(", ")}
team_size: ${TEAM_SIZE.join(", ")}
modality[]: ${MODALITY.join(", ")}
n_subjects / min_n_subjects: ${N_SUBJECTS.join(", ")}
annotation / annotation_required: ${ANNOTATION.join(", ")}
linkage[]: ${LINKAGE.join(", ")}
standards[]: ${STANDARDS.join(", ")}
readiness: ${READINESS.join(", ")}
consent_basis: ${CONSENT_BASIS.join(", ")}
access_model: ${ACCESS_MODEL.join(", ")}
data_can_leave_institution: ${YES_NO_UNSURE.join(", ")}
ethics_approval: ${ETHICS_APPROVAL.join(", ")}

Text: org_name, one_liner (<=140), summary (<=600), website, affiliation (individuals), track_record (up to 5 URLs), compute_scale, intended_public_contribution, funding_mainly_needed_for, best_public_dataset.
Data holders / consortia: datasets[] with name, modality, disease_area, n_subjects, volume, annotation, linkage, standards, readiness, consent_basis, access_model, ethics_approval, data_can_leave_institution, longitudinal — extract every modality and disease area the text supports (canonical enum strings, not display labels). Consortia also still_seeking[].
AI teams and independent experts: methods, application_target, domain_expertise (disease areas they work in), clinical_partner, compute, privacy_capability, regulatory_experience. Fill data_needs ONLY when they explicitly named data they want to work with; omit it when they have not decided. Independent people use kind "individual" (org_name is their name, org_type is "individual", team_size is "1"). Never use org_type "individual" for other kinds.
If a method, looking-for, or organisation type is not in the allowed list, set the enum to "other" and copy their own words into methods_other, looking_for_other, or org_type_other. Never invent those definitions.`

/**
 * Map prose or a chat transcript → validated PrefillProposal.
 * Returns null when the LLM is disabled or extraction fails after one retry.
 */
export async function proposeProfile(text: string): Promise<PrefillProposal | null> {
  const userContent = `${text.trim()}\n\nReturn one JSON object with every field the text supports. Include kind, org_name, country, one_liner, and summary when possible. Never include contact_name, contact_email, or contact_role.`

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete(
      [
        { role: "system", content: EXTRACT_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { json: true },
    )
    if (!raw) return null

    try {
      const parsed = prefillProposalSchema.parse(
        coerceUnknownOtherFields(JSON.parse(extractJsonObject(raw))),
      )
      return sanitizeProposal(parsed)
    } catch (e) {
      if (attempt === 0) {
        console.warn("[prefill] parse failed — retrying once", e instanceof Error ? e.message : e)
        continue
      }
      return null
    }
  }

  return null
}
