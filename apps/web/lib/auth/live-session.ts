import { redirect } from "next/navigation"
import type { Profile } from "@rmm/schema"
import { restoreOwnedProfile } from "@/lib/db/durable"
import { getProfileById, getProfilesByEmail } from "@/lib/db/profiles"
import { createSession, destroySession, getSession, type Session } from "@/lib/auth/session"
import { safeNextPath } from "@/lib/auth/next-path"

/**
 * Session cookie plus the listing it points at.
 *
 * On Vercel the SQLite file lives in /tmp, so a warm instance that accepted
 * a registration is not the instance that later serves /me. The cookie is
 * still valid HMAC; the row is gone from this isolate. We refill SQLite from
 * Blob before treating that as signed-out.
 *
 * Next.js forbids cookie writes in Server Components ("Cookies can only be
 * modified in a Server Action or Route Handler"). Clearing a stale session
 * from a page must bounce through GET /api/v1/auth/logout — never call
 * destroySession() during RSC render.
 */

export const CLEAR_SESSION_PATH = "/api/v1/auth/logout"
export const RECONCILE_SESSION_PATH = "/api/v1/auth/reconcile"

export interface LiveSession {
  session: Session & { profileId: string }
  profile: Profile
  /** The profile was recovered by verified email, so the cookie needs repair. */
  needsReconcile: boolean
}

/**
 * Resolve ownership by the signed profile id first, then by verified email.
 *
 * The fallback closes an important gap: an email can own a profile even when
 * an older or partially-created session still carries `profileId: null`.
 */
export function findOwnedProfile(session: Session): Profile | null {
  if (session.profileId) {
    const profile = getProfileById(session.profileId)
    if (profile) return profile
  }
  return getProfilesByEmail(session.email)[0] ?? null
}

export async function peekLiveSession(): Promise<LiveSession | null> {
  const session = await getSession()
  if (!session) return null
  let profile = findOwnedProfile(session)
  if (!profile) {
    await restoreOwnedProfile(session.profileId, session.email)
    profile = findOwnedProfile(session)
  }
  if (!profile) return null
  return {
    session: { ...session, profileId: profile.id },
    profile,
    needsReconcile: session.profileId !== profile.id,
  }
}

/**
 * Route-handler variant: may delete the cookie. Do not call from RSC.
 * A verified-email session with no listing is kept — they still need /register.
 */
export async function resolveLiveSession(): Promise<LiveSession | null> {
  const live = await peekLiveSession()
  if (live) {
    if (live.needsReconcile) await createSession(live.profile.id, live.session.email)
    return live
  }
  const session = await getSession()
  if (session?.profileId) await destroySession()
  return null
}

/**
 * Document-level cookie clear. The browser follows this redirect to a
 * Route Handler, which is allowed to Set-Cookie, then on to sign-in
 * (or `next` when the caller wants them back on a public page).
 */
export function redirectToClearSession(opts?: { stale?: boolean; next?: string }): never {
  const params = new URLSearchParams()
  if (opts?.stale) params.set("stale", "1")
  const next = safeNextPath(opts?.next)
  if (next) params.set("next", next)
  const q = params.toString()
  redirect(q ? `${CLEAR_SESSION_PATH}?${q}` : CLEAR_SESSION_PATH)
}

/**
 * For RSC pages that self-fetch the API: a 401/404 on your own listing
 * must clear the cookie on a Route Handler response. Set-Cookie from the
 * inner apiFetch is not forwarded to the browser.
 */
export async function redirectIfOwnListingGone(res: Response): Promise<void> {
  if (res.status === 401 || res.status === 403) {
    redirectToClearSession()
  }
  if (res.status === 404) {
    redirectToClearSession({ stale: true })
  }
}
