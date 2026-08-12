import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Admin gate: shared secret exchanged once via a form for a signed cookie.
 * The cookie stores an HMAC of the secret, not the secret itself, so it
 * cannot be replayed against a rotated secret.
 *
 * For the demo era we default to a trivial password when ADMIN_SECRET is
 * unset — set a real secret in production when you care.
 */

const ADMIN_COOKIE = "rmm_admin"
const DEMO_DEFAULT_SECRET = "password123"

function adminSecret(): string {
  const fromEnv = process.env.ADMIN_SECRET?.trim()
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEMO_DEFAULT_SECRET
}

function adminCookieValue(secret: string): string {
  return createHmac("sha256", secret).update("rmm-admin-v1").digest("base64url")
}

export function verifyAdminSecret(candidate: string): boolean {
  const secret = adminSecret()
  const a = Buffer.from(candidate)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function grantAdminCookie(): Promise<void> {
  const secret = adminSecret()
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, adminCookieValue(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  })
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
