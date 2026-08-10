import type { Profile } from "./profile"
import { deriveEligibleHq } from "./countries"

/**
 * Server-side derivation of the computed fields. Never trust the client for
 * these. Call this before persisting any profile write.
 */

/**
 * Fields that count toward completeness, per kind. Presence = non-empty.
 * The weighting is deliberately flat: completeness is a nudge signal and an
 * admin metric, not a score, so every field pulls its own weight equally.
 */
function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === "string") return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
}

const SHARED_FIELDS = [
  "org_name",
  "org_type",
  "country",
  "one_liner",
  "summary",
  "website",
  "languages",
  "looking_for",
  "application_status",
  "parallel_public_funding",
  "attending",
  "contact_name",
  "contact_email",
] as const

const AI_FIELDS = [
  "methods",
  "application_target",
  "domain_expertise",
  "clinical_partner",
  "regulatory_experience",
  "compute",
  "privacy_capability",
  "team_size",
  "track_record",
] as const

export function computeCompleteness(profile: Partial<Profile> & { kind: Profile["kind"] }): number {
  const record = profile as Record<string, unknown>
  const fields: string[] = [...SHARED_FIELDS]

  if (profile.kind === "data_holder" || profile.kind === "consortium") {
    fields.push("datasets")
  }
  if (profile.kind === "ai_team" || profile.kind === "consortium") {
    fields.push(...AI_FIELDS)
  }
  if (profile.kind === "consortium") {
    fields.push("still_seeking")
  }

  const present = fields.filter((f) => isPresent(record[f])).length
  return Math.round((present / fields.length) * 100)
}

/**
 * Apply all server-side derivations to a profile-shaped object, returning a
 * new object with `eligible_hq` and `completeness` overwritten from the
 * source-of-truth fields. Any client-supplied values for these are ignored.
 */
export function applyDerivedFields<T extends Partial<Profile> & { kind: Profile["kind"]; country: string }>(
  input: T,
): T & { eligible_hq: boolean; completeness: number } {
  return {
    ...input,
    eligible_hq: deriveEligibleHq(input.country),
    completeness: computeCompleteness(input),
  }
}
