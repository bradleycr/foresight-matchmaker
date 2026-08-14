import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Admin gate: a shared secret exchanged once via a form for a signed cookie.
 * The cookie stores an HMAC of the configured secret, not the secret itself,
 * so it cannot be replayed against a rotated secret.
 *
 * Demo era: `password123` always unlocks /admin, even when ADMIN_SECRET is
 * set to something else (as it is on Vercel). The env value remains valid
 * too, so a rotated secret does not lock anyone out of a live demo.
 */

const ADMIN_COOKIE = "rmm_admin"
const DEMO_DEFAULT_SECRET = "password123"

type CookieJar = {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean
      sameSite?: "lax" | "strict" | "none"
      secure?: boolean
      path?: string
      maxAge?: number
    },
  ) => unknown
}

function adminSecret(): string {
  const fromEnv = process.env.ADMIN_SECRET?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEMO_DEFAULT_SECRET
}

function secretsEqual(candidate: string, secret: string): boolean {
  const a = Buffer.from(candidate)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

function adminCookieValue(secret: string): string {
  return createHmac("sha256", secret).update("rmm-admin-v1").digest("base64url")
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  }
}

export function verifyAdminSecret(candidate: string): boolean {
  const trimmed = candidate.trim()
  if (!trimmed) return false
  return secretsEqual(trimmed, adminSecret()) || secretsEqual(trimmed, DEMO_DEFAULT_SECRET)
}

/** Write the signed admin cookie onto any jar — `cookies()` or a `NextResponse`. */
export function writeAdminCookie(jar: CookieJar): void {
  jar.set(ADMIN_COOKIE, adminCookieValue(adminSecret()), cookieOptions())
}

export async function grantAdminCookie(): Promise<void> {
  writeAdminCookie(await cookies())
}

export async function isAdmin(): Promise<boolean> {
  const secret = adminSecret()
  const jar = await cookies()
  const value = jar.get(ADMIN_COOKIE)?.value
  if (!value) return false
  const expected = adminCookieValue(secret)
  const a = Buffer.from(value)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
