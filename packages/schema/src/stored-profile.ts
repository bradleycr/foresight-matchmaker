import { z } from "zod"
import { profileSchema, type Profile } from "./profile"

/**
 * How we read listings that already exist, versus how we accept a new write.
 *
 * Friday 4 September 2026 we started requiring a definition whenever someone
 * ticked Other on modality / disease area. That is the right rule for the
 * form. Hydrate was using the same `profileSchema.safeParse`, and a failure
 * returned `null` with no log — so 17 real production listings vanished from
 * the directory while their JSON stayed in Supabase.
 *
 * Writes still go through `profileSchema` (strict). Reads go through
 * `parseStoredProfile`, which fills a missing Other definition just enough
 * for the row to stay listed. The owner can replace the placeholder when
 * they next edit.
 */

export const LEGACY_OTHER_PLACEHOLDER = "Other"

export function formatProfileIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
}

function definedOther(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function fillArrayOther(record: Record<string, unknown>, arrayKey: string, otherKey: string): boolean {
  const values = record[arrayKey]
  if (!Array.isArray(values) || !values.includes("other")) return false
  if (definedOther(record[otherKey])) return false
  record[otherKey] = LEGACY_OTHER_PLACEHOLDER
  return true
}

function repairDataset(dataset: unknown): boolean {
  if (!dataset || typeof dataset !== "object") return false
  const record = dataset as Record<string, unknown>
  const modality = fillArrayOther(record, "modality", "modality_other")
  const disease = fillArrayOther(record, "disease_area", "disease_area_other")
  return modality || disease
}

/**
 * Clone a stored profile and fill Other definitions the write schema now
 * requires. Returns the original reference when nothing needed repair.
 */
export function repairLegacyOtherFields(raw: unknown): { value: unknown; repaired: boolean } {
  if (!raw || typeof raw !== "object") return { value: raw, repaired: false }

  const profile = structuredClone(raw) as Record<string, unknown>
  let repaired = false

  if (profile.org_type === "other" && !definedOther(profile.org_type_other)) {
    profile.org_type_other = LEGACY_OTHER_PLACEHOLDER
    repaired = true
  }
  if (fillArrayOther(profile, "looking_for", "looking_for_other")) repaired = true
  if (Array.isArray(profile.still_seeking) && profile.still_seeking.includes("other")) {
    if (!definedOther(profile.looking_for_other)) {
      profile.looking_for_other = LEGACY_OTHER_PLACEHOLDER
      repaired = true
    }
  }
  if (fillArrayOther(profile, "methods", "methods_other")) repaired = true
  if (repairDataset(profile.data_needs)) repaired = true
  if (Array.isArray(profile.datasets)) {
    for (const dataset of profile.datasets) {
      if (repairDataset(dataset)) repaired = true
    }
  }

  return repaired ? { value: profile, repaired: true } : { value: raw, repaired: false }
}

export type StoredProfileParse =
  | { success: true; data: Profile; repaired: boolean }
  | { success: false; issues: string[] }

/**
 * Parse a listing that already lives in durable storage.
 *
 * Strict write rules still apply to POST /profiles. This path exists so a
 * later form validation must not erase people who already published.
 */
export function parseStoredProfile(raw: unknown): StoredProfileParse {
  const strict = profileSchema.safeParse(raw)
  if (strict.success) return { success: true, data: strict.data, repaired: false }

  const { value } = repairLegacyOtherFields(raw)
  const compat = profileSchema.safeParse(value)
  if (compat.success) return { success: true, data: compat.data, repaired: true }

  return { success: false, issues: formatProfileIssues(strict.error) }
}
