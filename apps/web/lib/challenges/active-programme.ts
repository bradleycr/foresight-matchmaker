import { cookies } from "next/headers"
import { CHALLENGE_ID, type ChallengeId } from "@rmm/schema"
import { challengeIdOf } from "./catalog"

/**
 * Which programme desk this browser is working in.
 *
 * After sign-in the person picks a programme; Directory (and similar) then
 * follow that choice. The cookie is a UX preference among programmes they
 * may already see — not an unlock. Listing ownership stays on the session.
 */

export const DESK_COOKIE = "mm_desk"
const MAX_AGE_SEC = 60 * 60 * 24 * 90

export function parseDeskCookie(raw: string | undefined | null): ChallengeId | null {
  if (!raw) return null
  const id = raw.trim()
  return CHALLENGE_ID.includes(id as ChallengeId) ? (id as ChallengeId) : null
}

/** Raw desk preference from the cookie (caller checks visibility). */
export async function requestDeskPreference(): Promise<ChallengeId | null> {
  const jar = await cookies()
  return parseDeskCookie(jar.get(DESK_COOKIE)?.value)
}

export function deskCookieOptions(id: ChallengeId) {
  return {
    name: DESK_COOKIE,
    value: challengeIdOf(id),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  }
}
