import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { toPublicProfile } from "@rmm/schema"
import { profileInputSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized } from "@/lib/api/respond"
import { getProfilesByEmail, markClaimed, saveProfile, slugFor } from "@/lib/db/profiles"
import { createSession, getSession, hasListing } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/profiles — publish a listing.
 *
 * The contact address must already be confirmed (magic-link session).
 * Email on the payload is ignored: the listing is bound to the session.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized("Confirm your email before adding a listing.")
  if (hasListing(session)) {
    return badRequest("This email already has a listing. Sign in to edit it, or delete it in Your profile to add a new one.")
  }

  const existing = getProfilesByEmail(session.email)
  if (existing.length > 0) {
    return badRequest("This email already has a listing. Sign in to edit it, or delete it in Your profile to add a new one.")
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input
  try {
    input = profileInputSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  let profile
  try {
    profile = saveProfile(
      { ...input, slug: slugFor(input.org_name), contact_email: session.email },
      { isNew: true },
    )
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  await createSession(profile.id, session.email)
  markClaimed(profile.id)

  return ok(
    {
      profile: toPublicProfile(profile),
      email_sent: false,
    },
    { status: 201 },
  )
}
