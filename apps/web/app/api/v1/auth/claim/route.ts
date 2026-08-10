import { NextRequest } from "next/server"
import { z, ZodError } from "zod"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { consumeToken } from "@/lib/auth/tokens"
import { createSession } from "@/lib/auth/session"
import { getProfilesByEmail, markClaimed } from "@/lib/db/profiles"

export const dynamic = "force-dynamic"

const claimSchema = z.object({ token: z.string().min(1) })

/**
 * POST /api/v1/auth/claim — exchange a magic-link token for a session.
 *
 * Deliberately a POST triggered by a button on /claim/[token], never a GET
 * side effect: link prefetchers and mail scanners must not be able to burn
 * a single-use token.
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
    // One generic message — don't distinguish invalid / expired / used
    // (helps against token-oracle probing).
    return badRequest("This sign-in link is not valid. Request a new one from the sign-in page.")
  }

  const profileId = result.profileId ?? getProfilesByEmail(result.email)[0]?.id
  if (!profileId) {
    return badRequest("This sign-in link is not valid. Request a new one from the sign-in page.")
  }

  await createSession(profileId, result.email)
  markClaimed(profileId)

  return ok({ signed_in: true, profile_id: profileId })
}
