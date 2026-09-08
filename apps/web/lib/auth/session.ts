import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Stateless signed sessions. The cookie value is
 * `base64url(payload).hmac-sha256(payload)` — nothing server-side to store
 * or garbage-collect, and tampering with the payload breaks the signature.
 *
 * Host-only (no Domain), httpOnly, SameSite=Lax, 30-day expiry. A Domain
 * attribute would not share the cookie with Vercel preview hosts, and it
 * would split from any existing host-only cookie — two `rmm_session` values,
 * logout clearing one, the other still signing people in.
 *
 * Writes go onto both `cookies()` and, when the caller has one, the
 * `NextResponse` itself. Admin login already stamped Set-Cookie on the
 * response because a 303 built with `NextResponse.redirect()` can drop the
 * mutable cookie store. Session cookies had the same gap: `maxAge` never
 * made it onto the wire, so the browser treated them as session cookies
 * and forgot them the next time the app was opened.
 */

export const SESSION_COOKIE = "rmm_session"
export const SESSION_TTL_DAYS = 30
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
/**
 * Refresh when the cookie is older than a day. Safari’s ITP can drop idle
 * cookies well before 30 days; sliding on activity keeps event-day visits
 * signed in without rewriting the cookie on every request.
 */
const REFRESH_WHEN_REMAINING_LT_MS = SESSION_TTL_MS - 24 * 60 * 60 * 1000

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

export type SessionCookieJar = {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean
      sameSite?: "lax" | "strict" | "none"
      secure?: boolean
      path?: string
      maxAge?: number
      expires?: Date
    },
  ) => unknown
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
}

/** Attributes every `rmm_session` write must share, including logout. */
export function sessionCookieOptions(nowMs = Date.now()): {
  httpOnly: true
  sameSite: "lax"
  secure: boolean
  path: "/"
  maxAge: number
  expires: Date
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    // Safari historically honoured Expires more reliably than Max-Age alone.
    expires: new Date(nowMs + SESSION_TTL_MS),
  }
}

export function writeSessionCookie(jar: SessionCookieJar, session: Session): void {
  jar.set(SESSION_COOKIE, encodeSession(session), sessionCookieOptions())
}

export function clearSessionCookie(jar: SessionCookieJar): void {
  jar.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  })
}

export function makeSession(profileId: string | null, email: string, nowMs = Date.now()): Session {
  return {
    profileId,
    email: email.toLowerCase(),
    exp: nowMs + SESSION_TTL_MS,
  }
}

// ---------------------------------------------------------------------------
// Cookie plumbing (server components / route handlers)
// ---------------------------------------------------------------------------

/**
 * Issue a session. When `jar` is the response cookie store, Set-Cookie is
 * stamped on the bytes that actually leave the server — not only Next's
 * mutable request cookie store, which a later `NextResponse.json()` /
 * `redirect()` can fail to copy.
 */
export async function createSession(
  profileId: string | null,
  email: string,
  jar?: SessionCookieJar,
): Promise<Session> {
  const session = makeSession(profileId, email)
  writeSessionCookie(await cookies(), session)
  if (jar) writeSessionCookie(jar, session)
  return session
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies()
  return decodeSession(jar.get(SESSION_COOKIE)?.value)
}

export async function destroySession(jar?: SessionCookieJar): Promise<void> {
  clearSessionCookie(await cookies())
  if (jar) clearSessionCookie(jar)
}

/** True when the cookie is older than a day — time to slide the expiry. */
export function sessionNeedsRefresh(session: Session, nowMs = Date.now()): boolean {
  return session.exp - nowMs < REFRESH_WHEN_REMAINING_LT_MS
}

/**
 * Extend a valid session to a full 30 days from now. No-op when plenty of
 * time remains, so we are not rewriting the cookie on every request.
 */
export async function touchSession(session: Session, jar?: SessionCookieJar): Promise<boolean> {
  if (!sessionNeedsRefresh(session)) return false
  await createSession(session.profileId, session.email, jar)
  return true
}
