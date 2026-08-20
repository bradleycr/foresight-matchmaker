import { z } from "zod"
import {
  orgTypeEnum,
  languageEnum,
  lookingForEnum,
  applicationStatusEnum,
  yesNoUnsureEnum,
  attendingEnum,
  visibilityEnum,
  methodsEnum,
  applicationTargetEnum,
  diseaseAreaEnum,
  clinicalPartnerEnum,
  regulatoryExperienceEnum,
  computeEnum,
  privacyCapabilityEnum,
  teamSizeEnum,
  challengeIdEnum,
} from "./enums"
import { datasetSchema, dataNeedsSchema } from "./dataset"

// ---------------------------------------------------------------------------
// Shared fields (all kinds)
// ---------------------------------------------------------------------------

/**
 * Contact person. Name and role stay private. Email is shown to signed-in
 * members so they can write directly — the directory is not a public listing.
 */
export const contactSchema = z.object({
  contact_name: z.string().min(1).max(160),
  contact_email: z.string().email(),
  contact_role: z.string().max(160).optional(),
})

export type Contact = z.infer<typeof contactSchema>

const sharedProfileFields = {
  id: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be url-safe kebab-case"),
  /**
   * Programme this listing belongs to. Defaults to Recoding Medicine so
   * existing seed and golden profiles stay valid without a data rewrite.
   */
  challenge_id: challengeIdEnum.default("recoding_medicine"),
  org_name: z.string().min(1).max(200),
  org_type: orgTypeEnum,
  /** ISO 3166-1 alpha-2. */
  country: z.string().length(2).regex(/^[A-Z]{2}$/, "country must be ISO 3166-1 alpha-2 uppercase"),
  /** DERIVED server-side from `country`. Never user-asserted. */
  eligible_hq: z.boolean(),
  /**
   * Collaboration-only listing. SPRIND allows partners outside the eligible
   * HQ region — they cannot lead an application, but they stay visible and
   * matchable. Distinct from `eligible_hq`: an ineligible HQ with
   * `partner_only: false` is hard-blocked; with `partner_only: true` it is not.
   */
  partner_only: z.boolean().default(false),
  one_liner: z.string().min(1).max(140),
  summary: z.string().max(600),
  website: z.string().url().optional(),
  /** Public LinkedIn profile URL for people who prefer to connect there. */
  linkedin: z.string().url().optional(),
  languages: z.array(languageEnum).default([]),
  looking_for: z.array(lookingForEnum).default([]),
  looking_for_other: z.string().max(200).optional(),
  application_status: applicationStatusEnum,
  /**
   * Kept on stored profiles so existing rows still parse. No longer shown
   * on the form and no longer used in matching — SPRIND confirmed it does
   * not affect the decision.
   */
  parallel_public_funding: yesNoUnsureEnum.default("no"),
  attending: z.array(attendingEnum).default([]),
  open_to_intros: z.boolean().default(true),
  visibility: visibilityEnum.default("authenticated_only"),
  org_type_other: z.string().max(200).optional(),
  intended_public_contribution: z.string().max(600).optional(),
  funding_mainly_needed_for: z.string().max(200).optional(),
  best_public_dataset: z.string().max(400).optional(),
  // Name and role stay private. Email is on the member directory.
  contact_name: contactSchema.shape.contact_name,
  contact_email: contactSchema.shape.contact_email,
  contact_role: contactSchema.shape.contact_role,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  claimed_at: z.string().datetime().optional(),
  /** DERIVED 0–100; drives nudges and admin metrics. */
  completeness: z.number().int().min(0).max(100),
}

// ---------------------------------------------------------------------------
// AI capability fields (shared by ai_team, consortium, and individual)
// ---------------------------------------------------------------------------

const aiTeamFields = {
  methods: z.array(methodsEnum).default([]),
  methods_other: z.string().max(200).optional(),
  application_target: z.array(applicationTargetEnum).default([]),
  domain_expertise: z.array(diseaseAreaEnum).default([]),
  clinical_partner: clinicalPartnerEnum,
  regulatory_experience: z.array(regulatoryExperienceEnum).default([]),
  compute: computeEnum,
  compute_scale: z.string().max(120).optional(),
  privacy_capability: z.array(privacyCapabilityEnum).default([]),
  team_size: teamSizeEnum,
  track_record: z.array(z.string().url()).max(5).default([]),
  data_needs: dataNeedsSchema,
}

// ---------------------------------------------------------------------------
// The four profile kinds
// ---------------------------------------------------------------------------

export const dataHolderSchema = z.object({
  ...sharedProfileFields,
  kind: z.literal("data_holder"),
  datasets: z.array(datasetSchema).min(1),
})
export type DataHolder = z.infer<typeof dataHolderSchema>

export const aiTeamSchema = z.object({
  ...sharedProfileFields,
  kind: z.literal("ai_team"),
  ...aiTeamFields,
})
export type AiTeam = z.infer<typeof aiTeamSchema>

export const consortiumSchema = z.object({
  ...sharedProfileFields,
  kind: z.literal("consortium"),
  datasets: z.array(datasetSchema).min(1),
  ...aiTeamFields,
  /** A consortium is excluded from matching unless this is non-empty. */
  still_seeking: z.array(lookingForEnum).default([]),
})
export type Consortium = z.infer<typeof consortiumSchema>

/**
 * An independent expert — same AI capability fields as an AI team, but the
 * listing is a person. `org_name` is their display name. Matched with AI
 * teams and seeking consortia, not with data holders.
 */
export const individualSchema = z.object({
  ...sharedProfileFields,
  kind: z.literal("individual"),
  ...aiTeamFields,
  /** Optional current institution, lab, or employer. */
  affiliation: z.string().max(200).optional(),
})
export type Individual = z.infer<typeof individualSchema>

/** Discriminated union across applicant profiles. */
export const profileSchema = z
  .discriminatedUnion("kind", [dataHolderSchema, aiTeamSchema, consortiumSchema, individualSchema])
  .superRefine((data, ctx) => {
    if (data.org_type === "other" && !data.org_type_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["org_type_other"],
        message: "Please define the organisation type.",
      })
    }
    const looking = [
      ...(data.looking_for ?? []),
      ...("still_seeking" in data ? (data.still_seeking ?? []) : []),
    ]
    if (looking.includes("other") && !data.looking_for_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["looking_for_other"],
        message: "Please define what you are looking for.",
      })
    }
    if ("methods" in data && data.methods?.includes("other") && !data.methods_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["methods_other"],
        message: "Please define the method.",
      })
    }
  })
export type Profile = z.infer<typeof profileSchema>

// ---------------------------------------------------------------------------
// Public (redacted) profile — the ONLY shape that leaves the server publicly
// ---------------------------------------------------------------------------

const PRIVATE_KEYS = ["contact_name", "contact_role", "governance_notes"] as const

/**
 * Strip private fields from a profile for signed-in directory surfaces.
 * Contact email stays: members email each other directly. Name, role, and
 * dataset governance notes do not. Datasets flagged `publicly_describable:
 * false` are matched server-side but never described.
 *
 * If they closed contact, drop the email so it cannot leak via the API.
 */
export function toPublicProfile(profile: Profile): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...profile }
  for (const key of PRIVATE_KEYS) delete clone[key]
  if (!profile.open_to_intros) delete clone.contact_email

  if (Array.isArray((clone as { datasets?: unknown }).datasets)) {
    const datasets = (clone as { datasets: Array<Record<string, unknown>> }).datasets
    clone.datasets = datasets
      .filter((d) => d.publicly_describable === true)
      .map((d) => {
        const dClone = { ...d }
        delete dClone.governance_notes
        return dClone
      })
  }
  return clone
}

export type PublicProfile = ReturnType<typeof toPublicProfile>
