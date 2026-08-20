import { redirect } from "next/navigation"
import type { Profile } from "@rmm/schema"
import { getProfileById } from "@/lib/db/profiles"
import { destroySession, getSession, type Session } from "@/lib/auth/session"
import { safeNextPath } from "@/lib/auth/next-path"

/**
 * Session cookie plus the listing it points at.
 *
 * On Vercel the SQLite file lives in /tmp, so a warm instance that accepted
 * a registration is not the instance that later serves /me. The cookie is
 * still valid HMAC; the row is gone. Treat that as signed-out rather than
 * throwing through error.tsx.
 *
 * Next.js forbids cookie writes in Server Components ("Cookies can only be
 * modified in a Server Action or Route Handler"). Clearing a stale session
 * from a page must bounce through GET /api/v1/auth/logout — never call
 * destroySession() during RSC render.
 */

export const CLEAR_SESSION_PATH = "/api/v1/auth/logout"

export async function peekLiveSession(): Promise<{ session: Session & { profileId: string }; profile: Profile } | null> {
  const session = await getSession()
  if (!session?.profileId) return null
  const profile = getProfileById(session.profileId)
  if (!profile) return null
  return { session: session as Session & { profileId: string }, profile }
}

/**
 * Route-handler variant: may delete the cookie. Do not call from RSC.
 * A verified-email session with no listing is kept — they still need /register.
 */
export async function resolveLiveSession(): Promise<{ session: Session & { profileId: string }; profile: Profile } | null> {
  const live = await peekLiveSession()
  if (live) return live
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
