import { NextRequest, NextResponse } from "next/server"
import { CLEAR_SESSION_PATH, findOwnedProfile } from "@/lib/auth/live-session"
import { safeNextPath } from "@/lib/auth/next-path"
import { createSession, getSession, hasListing, touchSession } from "@/lib/auth/session"
import { restoreOwnedProfile } from "@/lib/db/durable"

export const dynamic = "force-dynamic"

/**
 * Repair a verified session whose profile id is missing or stale.
 *
 * Server Components may discover ownership by email, but only a Route Handler
 * may update the signed cookie. This document bounce performs that repair
 * before continuing to the requested account page.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL("/signin", req.url), 303)

  await restoreOwnedProfile(session.profileId, session.email)
  const profile = findOwnedProfile(session)
  const requested = safeNextPath(req.nextUrl.searchParams.get("next"))

  if (!profile) {
    // A session that names a profile has registered before, so a silent trip
    // to the empty form would read as losing their work without explanation.
    if (hasListing(session)) {
      const stale = new URL(CLEAR_SESSION_PATH, req.url)
      stale.searchParams.set("stale", "1")
      return NextResponse.redirect(stale, 303)
    }
    return NextResponse.redirect(new URL("/register", req.url), 303)
  }

  if (session.profileId !== profile.id) {
    await createSession(profile.id, session.email)
  } else {
    await touchSession({ ...session, profileId: profile.id })
  }

  return NextResponse.redirect(new URL(requested ?? "/me", req.url), 303)
}
