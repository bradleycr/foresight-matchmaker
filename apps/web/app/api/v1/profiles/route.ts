import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { toPublicProfile } from "@rmm/schema"
import { profileInputSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized, unavailable } from "@/lib/api/respond"
import { getProfilesByEmail, markClaimed, saveProfile, slugFor } from "@/lib/db/profiles"
import { persistListing, restoreOwnedProfile } from "@/lib/db/durable"
import { createSession, getSession } from "@/lib/auth/session"
import { backupProfileByEmail } from "@/lib/ops/profile-backup"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/profiles — publish a listing.
 *
 * The contact address must already be confirmed (magic-link session).
 * Email on the payload is ignored: the listing is bound to the session.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized("Confirm your email before adding a profile.")

  // One profile per email, decided by the database alone. A cookie can still
  // name a profile that no longer exists, and refusing on that basis would
  // block the only recovery someone in that state has left. Restore from Blob
  // first so a listing created on another instance is not duplicated.
  await restoreOwnedProfile(session.profileId, session.email)
  const existing = getProfilesByEmail(session.email)
  if (existing.length > 0) {
    return badRequest("This email already has a profile. Sign in to edit it, or delete it in Your profile to add a new one.")
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

  markClaimed(profile.id)
  const claimed = getProfilesByEmail(session.email)[0] ?? profile
  try {
    await persistListing(claimed)
  } catch (error) {
    console.error("[durable] persist after create failed", { id: claimed.id }, error)
    return unavailable("Your profile was saved on this server but not yet stored for the next one. Wait a moment and open Your profile — if it is missing, submit again.")
  }
  await createSession(claimed.id, session.email)
  await backupProfileByEmail(claimed, "created")

  return ok(
    {
      profile: toPublicProfile(claimed),
      email_sent: false,
    },
    { status: 201 },
  )
}
