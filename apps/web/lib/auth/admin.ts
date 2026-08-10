import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Admin gate: a shared secret in ADMIN_SECRET, exchanged once via a form for
 * a signed cookie. The cookie stores an HMAC of the secret, not the secret
 * itself, so it cannot be replayed against a rotated secret.
 */

const ADMIN_COOKIE = "rmm_admin"

function adminSecret(): string | null {
  return process.env.ADMIN_SECRET ?? null
}

function adminCookieValue(secret: string): string {
  return createHmac("sha256", secret).update("rmm-admin-v1").digest("base64url")
}

export function verifyAdminSecret(candidate: string): boolean {
  const secret = adminSecret()
  if (!secret) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function grantAdminCookie(): Promise<void> {
  const secret = adminSecret()
  if (!secret) return
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
  if (!secret) return false
  const jar = await cookies()
  const value = jar.get(ADMIN_COOKIE)?.value
  if (!value) return false
  const expected = adminCookieValue(secret)
  const a = Buffer.from(value)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
