/**
 * Checked-in eligibility geography for the SPRIND Recoding Medicine challenge.
 *
 * Hard rule (do not "improve"): applicant HQ must be in the EU, EFTA, UK, or
 * Israel. `eligible_hq` is DERIVED from `country` against this list, server-side.
 * The user never asserts eligibility directly.
 *
 * Codes are ISO 3166-1 alpha-2.
 */

/** 27 EU member states. */
export const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const

/** EFTA: Iceland, Liechtenstein, Norway, Switzerland. */
export const EFTA_COUNTRIES = ["IS", "LI", "NO", "CH"] as const

/** Additional eligible territories named in the challenge rules. */
export const OTHER_ELIGIBLE_COUNTRIES = ["GB", "IL"] as const

/** The complete set of HQ-eligible country codes. */
export const ELIGIBLE_HQ_COUNTRIES: ReadonlySet<string> = new Set<string>([
  ...EU_COUNTRIES,
  ...EFTA_COUNTRIES,
  ...OTHER_ELIGIBLE_COUNTRIES,
])

/**
 * Derive `eligible_hq` from an ISO 3166-1 alpha-2 country code.
 * Case-insensitive; unknown or malformed codes are not eligible.
 */
export function deriveEligibleHq(country: string): boolean {
  if (typeof country !== "string") return false
  return ELIGIBLE_HQ_COUNTRIES.has(country.toUpperCase())
}
