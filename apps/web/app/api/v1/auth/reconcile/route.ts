import { NextRequest, NextResponse } from "next/server"
import { findOwnedProfile } from "@/lib/auth/live-session"
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
    // The listing row is missing from this Vercel isolate. A valid HMAC
    // session should never be destroyed just because /tmp SQLite was cold.
    // Send them where they were going — their session is still good, and
    // the next page load will retry hydration. Only clear when the session
    // itself has no profileId (they genuinely never published).
    if (!hasListing(session)) {
      return NextResponse.redirect(new URL("/register", req.url), 303)
    }
    // Keep the cookie alive — touch it so it does not expire between now
    // and the next successful hydration.
    await touchSession(session)
    return NextResponse.redirect(new URL(requested ?? "/me", req.url), 303)
  }

  if (session.profileId !== profile.id) {
    await createSession(profile.id, session.email)
  } else {
    await touchSession({ ...session, profileId: profile.id })
  }

  return NextResponse.redirect(new URL(requested ?? "/me", req.url), 303)
}
