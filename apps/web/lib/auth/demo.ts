import { timingSafeEqual } from "node:crypto"

/**
 * Password gate for /demo — drops you straight into the operator listing
 * without a magic link. Same shared secret as /admin by default so one
 * passphrase covers both operator desks on event day.
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
