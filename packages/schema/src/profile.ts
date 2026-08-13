import { z } from "zod"
import {
  kindEnum,
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
 * PRIVATE contact block. Held on every profile, but stripped by server-side
 * redaction before any public payload. Verified by test.
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
  languages: z.array(languageEnum).default([]),
  looking_for: z.array(lookingForEnum).default([]),
  application_status: applicationStatusEnum,
  parallel_public_funding: yesNoUnsureEnum,
  attending: z.array(attendingEnum).default([]),
  open_to_intros: z.boolean().default(true),
  visibility: visibilityEnum.default("public"),
  // PRIVATE — redacted from public payloads.
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
// AI team fields (shared by ai_team and consortium)
// ---------------------------------------------------------------------------

const aiTeamFields = {
  methods: z.array(methodsEnum).default([]),
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
// The three profile kinds
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

/** Discriminated union across the three SPRIND applicant profiles. */
export const profileSchema = z.discriminatedUnion("kind", [
  dataHolderSchema,
  aiTeamSchema,
  consortiumSchema,
])
export type Profile = z.infer<typeof profileSchema>

// ---------------------------------------------------------------------------
// Public (redacted) profile — the ONLY shape that leaves the server publicly
// ---------------------------------------------------------------------------

const PRIVATE_KEYS = ["contact_name", "contact_email", "contact_role", "governance_notes"] as const

/**
 * Strip every private field from a profile, producing a payload safe for any
 * public surface. Also removes datasets flagged `publicly_describable: false`
 * (they are still matched on server-side, just never publicly described) and
 * strips `governance_notes` from any dataset that does survive.
 *
 * This is the single choke point for redaction — server code must route all
 * public output through here, and a test asserts no private key survives.
 */
export function toPublicProfile(profile: Profile): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...profile }
  for (const key of PRIVATE_KEYS) delete clone[key]

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
