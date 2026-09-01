import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Stateless signed sessions. The cookie value is
 * `base64url(payload).hmac-sha256(payload)` — nothing server-side to store
 * or garbage-collect, and tampering with the payload breaks the signature.
 *
 * httpOnly, SameSite=Lax, 30-day expiry, per the spec. No passwords, no
 * OAuth, no third-party SDK.
 */

const SESSION_COOKIE = "rmm_session"
const SESSION_TTL_DAYS = 30
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
/** Refresh the cookie when less than half the TTL remains — keeps active users signed in. */
const REFRESH_WHEN_REMAINING_LT_MS = SESSION_TTL_MS / 2

export interface Session {
  /**
   * The listing this session controls. Null after email is confirmed and
   * before the first listing is published — they may fill /register, not /me.
   */
  profileId: string | null
  email: string
  /** Unix ms expiry, embedded and signed. */
  exp: number
}

export function hasListing(session: Session): session is Session & { profileId: string } {
  return typeof session.profileId === "string" && session.profileId.length > 0
}

function secret(): string {
  // A missing secret must not silently produce forgeable sessions in prod.
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production")
  return "dev-only-insecure-secret"
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function decodeSession(value: string | undefined): Session | null {
  if (!value) return null
  const dot = value.lastIndexOf(".")
  if (dot < 0) return null

  const payload = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session
    if (typeof session.email !== "string" || session.exp < Date.now()) return null
    if (session.profileId !== null && typeof session.profileId !== "string") return null
    if (session.profileId === "") session.profileId = null
    return session
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cookie plumbing (server components / route handlers)
// ---------------------------------------------------------------------------

export async function createSession(profileId: string | null, email: string): Promise<void> {
  const session: Session = {
    profileId,
    email: email.toLowerCase(),
    exp: Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  }
  const jar = await cookies()
  jar.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  })
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  return decodeSession(jar.get(SESSION_COOKIE)?.value)
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

/** True when the signed session is past the halfway mark — time to slide the expiry. */
export function sessionNeedsRefresh(session: Session, nowMs = Date.now()): boolean {
  return session.exp - nowMs < REFRESH_WHEN_REMAINING_LT_MS
}

/**
 * Extend a valid session to a full 30 days from now. No-op when plenty of
 * time remains, so we are not rewriting the cookie on every request.
 */
export async function touchSession(session: Session): Promise<boolean> {
  if (!sessionNeedsRefresh(session)) return false
  await createSession(session.profileId, session.email)
  return true
}
