import { cache } from "react"
import { redirect } from "next/navigation"
import type { Profile } from "@rmm/schema"
import { restoreOwnedProfile, hydrateListings } from "@/lib/db/durable"
import { getProfileById, getProfilesByEmail } from "@/lib/db/profiles"
import { createSession, getSession, touchSession, type Session } from "@/lib/auth/session"
import { safeNextPath } from "@/lib/auth/next-path"

/**
 * Session cookie plus the listing it points at.
 *
 * On Vercel the SQLite file lives in /tmp, so a warm instance that accepted
 * a registration is not the instance that later serves /me. The cookie is
 * still valid HMAC; the row is gone from this isolate. We refill SQLite from
 * durable store before treating that as signed-out.
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
 * The id must belong to this mailbox — a warm isolate can keep a ghost row
 * whose UUID no longer matches the durable email pointer. Falling back by
 * email closes that gap (and the case where the cookie still has
 * `profileId: null` after a partial create).
 */
export function findOwnedProfile(session: Session): Profile | null {
  const email = session.email.toLowerCase()
  if (session.profileId) {
    const profile = getProfileById(session.profileId)
    if (profile && profile.contact_email.toLowerCase() === email) return profile
  }
  return getProfilesByEmail(session.email)[0] ?? null
}

export const peekLiveSession = cache(async function peekLiveSession(): Promise<LiveSession | null> {
  const session = await getSession()
  if (!session) return null
  // Always refill from durable first. Skipping when a local row exists left
  // ghost UUIDs bound to /me while the directory showed the real listing.
  await restoreOwnedProfile(session.profileId, session.email)
  let profile = findOwnedProfile(session)
  if (!profile) {
    await hydrateListings()
    profile = findOwnedProfile(session)
  }
  if (!profile) return null
  return {
    session: { ...session, profileId: profile.id },
    profile,
    needsReconcile: session.profileId !== profile.id,
  }
})

/**
 * Route-handler variant: may delete the cookie. Do not call from RSC.
 * A verified-email session with no listing is kept — they still need /register.
 */
export async function resolveLiveSession(): Promise<LiveSession | null> {
  const live = await peekLiveSession()
  if (live) {
    if (live.needsReconcile) await createSession(live.profile.id, live.session.email)
    else await touchSession(live.session)
    return live
  }
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
 * Keep a verified session. A missing listing on this isolate is not a sign-out.
 */
export async function redirectIfOwnListingGone(res: Response): Promise<void> {
  if (res.status === 401 || res.status === 403) {
    redirect("/register")
  }
  if (res.status === 404) {
    redirect("/register")
  }
}
