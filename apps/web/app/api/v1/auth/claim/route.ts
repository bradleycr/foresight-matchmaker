import { NextRequest } from "next/server"
import { z, ZodError } from "zod"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { consumeToken } from "@/lib/auth/tokens"
import { createSession } from "@/lib/auth/session"
import { getProfilesByEmail, markClaimed } from "@/lib/db/profiles"
import { persistListing, restoreOwnedProfile } from "@/lib/db/durable"

export const dynamic = "force-dynamic"

const claimSchema = z.object({ token: z.string().min(1) })

/**
 * POST /api/v1/auth/claim — exchange a magic-link token for a session.
 *
 * Deliberately a POST triggered by a button on /claim/[token], never a GET
 * side effect: link prefetchers and mail scanners must not be able to burn
 * a single-use token.
 *
 * A token with no listing still creates a session (email confirmed). The
 * client then sends them to /register to fill the profile.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input
  try {
    input = claimSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  const result = consumeToken(input.token)
  if (!result.ok) {
    return badRequest("This link is no longer valid. Request a new one.")
  }

  await restoreOwnedProfile(result.profileId, result.email)
  const profileId = result.profileId ?? getProfilesByEmail(result.email)[0]?.id ?? null

  await createSession(profileId, result.email)
  if (profileId) {
    markClaimed(profileId)
    const claimed = getProfilesByEmail(result.email)[0]
    if (claimed) {
      try {
        await persistListing(claimed)
      } catch (error) {
        console.error("[durable] persist after claim failed", { id: claimed.id }, error)
      }
    }
  }

  return ok({ signed_in: true, profile_id: profileId })
}
