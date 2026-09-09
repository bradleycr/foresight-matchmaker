import { timingSafeEqual } from "node:crypto"
import { isOnsiteCitySlug, type OnsiteCitySlug } from "@/lib/onsite/cities"

/**
 * Password gate for /demo — drops you straight into a listing without a
 * magic link. Defaults to the operator demo account; on event day staff
 * can pass any listed email and optionally check that person into a room.
 */

export const DEMO_EMAIL = "bradley@foresight.org"
export const DEMO_DEFAULT_SECRET = "FSRM2026!"

function secretsEqual(candidate: string, secret: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

function demoSecretFromEnv(): string | null {
  const fromEnv = process.env.DEMO_SECRET?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : null
}

/** Accept DEMO_SECRET when set, and always accept the event-day passphrase. */
export function verifyDemoSecret(candidate: string): boolean {
  const trimmed = candidate.trim()
  if (!trimmed) return false
  const fromEnv = demoSecretFromEnv()
  if (fromEnv && secretsEqual(trimmed, fromEnv)) return true
  return secretsEqual(trimmed, DEMO_DEFAULT_SECRET)
}

/** Optional email on the form — empty means the foresight-bradley demo. */
export function resolveDemoEmail(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().toLowerCase()
  if (!trimmed) return DEMO_EMAIL
  if (!trimmed.includes("@") || trimmed.length > 254) return DEMO_EMAIL
  return trimmed
}

/** Optional room check-in — empty means skip presence. */
export function resolveDemoCity(raw: string | null | undefined): OnsiteCitySlug | null {
  const trimmed = (raw ?? "").trim().toLowerCase()
  if (!trimmed) return null
  return isOnsiteCitySlug(trimmed) ? trimmed : null
}
