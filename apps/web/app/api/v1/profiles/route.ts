import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { toPublicProfile } from "@rmm/schema"
import { profileInputSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized } from "@/lib/api/respond"
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
    const current = existing[0]!
    try {
      await persistListing(current)
    } catch (error) {
      console.error("[durable] persist existing listing failed", { id: current.id }, error)
    }
    await createSession(current.id, session.email)
    return ok({ profile: toPublicProfile(current), email_sent: false, already: true })
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
    // The row is already on this instance and the session will point at it.
    // Failing the request here made creation look broken and skipped the cookie.
    console.error("[durable] persist after create failed", { id: claimed.id }, error)
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
