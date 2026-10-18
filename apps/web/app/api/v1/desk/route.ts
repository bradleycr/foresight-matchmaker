import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { safeNextPath, signInHref } from "@/lib/auth/next-path"
import { challengeIdOf, directoryHref } from "@/lib/challenges/catalog"
import { deskCookieOptions } from "@/lib/challenges/active-programme"
import { isChallengeVisible, requestDemoUnlock } from "@/lib/challenges/visibility"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/desk?challenge=…&next=…
 *
 * Stamp the active programme desk cookie and redirect. Sign-in required —
 * the choose-programme screen is for signed-in people.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await getSession()
  const url = new URL(req.url)
  const rawChallenge = url.searchParams.get("challenge")
  const next = safeNextPath(url.searchParams.get("next"))

  if (!session) {
    const back = next ?? (rawChallenge ? directoryHref(challengeIdOf(rawChallenge)) : "/programmes")
    return NextResponse.redirect(new URL(signInHref(back), req.url), 303)
  }

  const unlock = await requestDemoUnlock()
  const challengeId = challengeIdOf(rawChallenge)
  if (!isChallengeVisible(challengeId, unlock)) {
    return NextResponse.redirect(new URL("/programmes", req.url), 303)
  }

  const dest = next ?? directoryHref(challengeId)
  const res = NextResponse.redirect(new URL(dest, req.url), 303)
  const cookie = deskCookieOptions(challengeId)
  res.cookies.set(cookie.name, cookie.value, cookie)
  return res
}
