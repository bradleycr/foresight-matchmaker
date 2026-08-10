import { z } from "zod"
import {
  KIND,
  ORG_TYPE,
  LANGUAGE,
  LOOKING_FOR,
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

/**
 * LLM profile pre-fill (master prompt §8.1): the user pastes a paragraph of
 * prose, the model proposes structured fields, and the user reviews every
 * one of them in the form before saving. Nothing is ever auto-published.
 *
 * The model's output is treated as untrusted input: every field passes
 * through a tolerant Zod schema that silently DROPS anything invalid —
 * a wrong enum value or a hallucinated key degrades the proposal, never
 * the request.
 */

// --- tolerant parsing helpers ----------------------------------------------

/** A single enum value; anything invalid becomes undefined. */
function loose<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values).optional().catch(undefined)
}

/** An enum array; invalid members are filtered out, not fatal. */
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
  disease_area: looseArray(DISEASE_AREA),
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
  website: looseString(300),
  languages: looseArray(LANGUAGE),
  looking_for: looseArray(LOOKING_FOR),
  methods: looseArray(METHODS),
  application_target: looseArray(APPLICATION_TARGET),
  domain_expertise: looseArray(DISEASE_AREA),
  clinical_partner: loose(CLINICAL_PARTNER),
  regulatory_experience: looseArray(REGULATORY_EXPERIENCE),
  compute: loose(COMPUTE),
  privacy_capability: looseArray(PRIVACY_CAPABILITY),
  team_size: loose(TEAM_SIZE),
  track_record: z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : []),
    z.array(z.string()),
  ).catch([]),
  data_needs: z
    .object({
      modality: looseArray(MODALITY),
      disease_area: looseArray(DISEASE_AREA),
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

// --- prompt -----------------------------------------------------------------

const SYSTEM_PROMPT = `You extract a structured organisation profile from free text, for a directory pairing European health-data holders with AI/ML teams.

Return ONLY a JSON object. Include a field ONLY when the text clearly supports it — omit anything you are not sure about. Never invent facts, numbers, or contact details.

Allowed values (use these EXACT strings):
kind: ${KIND.join(", ")}
org_type: ${ORG_TYPE.join(", ")}
country: ISO 3166-1 alpha-2 code (e.g. DE, FR)
languages[]: ${LANGUAGE.join(", ")}
looking_for[]: ${LOOKING_FOR.join(", ")}
methods[]: ${METHODS.join(", ")}
application_target[]: ${APPLICATION_TARGET.join(", ")}
domain_expertise[] and disease_area[]: ${DISEASE_AREA.join(", ")}
clinical_partner: ${CLINICAL_PARTNER.join(", ")}
regulatory_experience[]: ${REGULATORY_EXPERIENCE.join(", ")}
compute: ${COMPUTE.join(", ")}
privacy_capability[]: ${PRIVACY_CAPABILITY.join(", ")}
team_size: ${TEAM_SIZE.join(", ")}
modality[]: ${MODALITY.join(", ")}
n_subjects / min_n_subjects: ${N_SUBJECTS.join(", ")}
volume: ${VOLUME.join(", ")}
annotation / annotation_required: ${ANNOTATION.join(", ")}
linkage[]: ${LINKAGE.join(", ")}
standards[]: ${STANDARDS.join(", ")}
readiness: ${READINESS.join(", ")}
consent_basis: ${CONSENT_BASIS.join(", ")}
access_model: ${ACCESS_MODEL.join(", ")}
data_can_leave_institution: ${YES_NO_UNSURE.join(", ")}
ethics_approval: ${ETHICS_APPROVAL.join(", ")}

Text fields: org_name (<=200 chars), one_liner (<=140), summary (<=600), website (URL), track_record (array of up to 5 short strings).
For data holders include "datasets": an array of dataset objects (name, modality, disease_area, n_subjects, volume, longitudinal, annotation, linkage, standards, readiness, consent_basis, access_model, data_can_leave_institution, ethics_approval).
For AI teams include "data_needs" (modality, disease_area, min_n_subjects, annotation_required, linkage_required, standards_preferred).`

/**
 * Ask the LLM for a proposal. Returns null when the LLM is disabled or
 * fails — the caller surfaces that as "pre-fill unavailable", and the
 * plain form remains the fully supported path.
 */
export async function proposeProfile(text: string): Promise<PrefillProposal | null> {
  const raw = await complete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    { json: true },
  )
  if (!raw) return null

  try {
    return prefillProposalSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}
