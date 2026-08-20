import { NextRequest, NextResponse } from "next/server"
import { findOwnedProfile } from "@/lib/auth/live-session"
import { safeNextPath } from "@/lib/auth/next-path"
import { createSession, getSession } from "@/lib/auth/session"

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

  const profile = findOwnedProfile(session)
  const requested = safeNextPath(req.nextUrl.searchParams.get("next"))

  if (!profile) {
    return NextResponse.redirect(new URL("/register", req.url), 303)
  }

  if (session.profileId !== profile.id) {
    await createSession(profile.id, session.email)
  }

  return NextResponse.redirect(new URL(requested ?? "/me", req.url), 303)
}
