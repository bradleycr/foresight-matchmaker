import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { toPublicProfile } from "@rmm/schema"
import { profileInputSchema, outcomeSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, notFound, unauthorized, forbidden, unavailable } from "@/lib/api/respond"
import {
  getProfileById,
  saveProfile,
  setJointApplicationOutcome,
  getJointApplicationOutcome,
  deleteProfile,
} from "@/lib/db/profiles"
import { forgetListing, persistListing, loadOwnedListing, ensureOwnedListing, PERSIST_UNAVAILABLE_MESSAGE } from "@/lib/db/durable"
import { getSession, createSession } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/admin"
import { backupProfileByEmail } from "@/lib/ops/profile-backup"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * Verified-email ownership. The cookie id is a hint; the durable email
 * pointer is the source of truth. A stale UUID in the URL or session must
 * not 404 when this mailbox still owns a listing.
 */
function ownsListing(
  session: { profileId: string | null; email: string },
  profile: { id: string; contact_email: string },
): boolean {
  return session.email.toLowerCase() === profile.contact_email.toLowerCase()
}

/**
 * GET /api/v1/profiles/[id]
 *
 * Members-only. The owner and the admin see the full profile; other signed-in
 * viewers see the redacted shape. Hidden profiles 404.
 */
export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to view this profile.")

  const { id } = await params
  await ensureOwnedListing(id, session.email)
  const profile = getProfileById(id)
  if (!profile) return notFound("No profile with that id.")

  const owner = ownsListing(session, profile)

  if (owner || (await isAdmin())) {
    const res = ok({
      profile,
      joint_application: getJointApplicationOutcome(profile.id),
    })
    if (owner && session.profileId !== profile.id) {
      await createSession(profile.id, session.email, res.cookies)
    }
    return res
  }

  if (profile.visibility === "hidden") return notFound("No profile with that id.")
  return ok({ profile: toPublicProfile(profile) })
}

/**
 * PATCH /api/v1/profiles/[id] — owner-only.
 *
 * Two payloads are accepted:
 *  - a full profile form (same shape as create; kind and programme cannot change), or
 *  - `{ joint_application: "yes" | "no" | "not_yet" }` — the one-click KPI
 *    self-report.
 */
export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params
  const session = await getSession()
  if (!session) return unauthorized()
  const profile = await loadOwnedListing(session.email, id)
  if (!profile) return notFound("No profile with that id.")
  if (!ownsListing(session, profile)) return forbidden("Only the profile owner can edit it.")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  // The KPI self-report path.
  const outcome = outcomeSchema.safeParse(body)
  if (outcome.success) {
    setJointApplicationOutcome(profile.id, outcome.data.joint_application)
    const reported = getProfileById(profile.id) ?? profile
    try {
      await persistListing(reported)
    } catch (error) {
      console.error("[durable] persist after outcome failed", { id: profile.id }, error)
      return unavailable(PERSIST_UNAVAILABLE_MESSAGE)
    }
    const res = ok({ joint_application: outcome.data.joint_application })
    if (session.profileId !== profile.id) {
      await createSession(profile.id, session.email, res.cookies)
    }
    return res
  }

  // The full-edit path.
  let input
  try {
    input = profileInputSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }
  if (input.kind !== profile.kind) {
    return badRequest("Profile type cannot be changed. Delete this profile in Your profile, then add a new one.")
  }
  const existingChallenge = profile.challenge_id ?? "recoding_medicine"
  if (input.challenge_id !== existingChallenge) {
    return badRequest("Programme cannot be changed. Delete this profile in Your profile, then add a new one.")
  }

  let updated
  try {
    updated = saveProfile({
      ...input,
      id: profile.id,
      slug: profile.slug,
      created_at: profile.created_at,
      claimed_at: profile.claimed_at,
    })
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  await backupProfileByEmail(updated, "updated")
  try {
    await persistListing(updated)
  } catch (error) {
    console.error("[durable] persist after update failed", { id: updated.id }, error)
    return unavailable(PERSIST_UNAVAILABLE_MESSAGE)
  }
  const res = ok({ profile: updated })
  if (session.profileId !== updated.id) {
    await createSession(updated.id, session.email, res.cookies)
  }
  return res
}

/**
 * DELETE /api/v1/profiles/[id] — owner-only GDPR erasure.
 *
 * Body must confirm with the exact organisation name:
 *   `{ "confirm_org_name": "…" }`
 * On success the profile and all linked personal data are removed. The
 * session stays verified (no listing) so the owner can add a new one
 * without confirming email again.
 */
export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params
  const session = await getSession()
  if (!session) return unauthorized()
  const profile = await loadOwnedListing(session.email, id)
  if (!profile) return notFound("No profile with that id.")
  if (!ownsListing(session, profile)) return forbidden("Only the profile owner can delete it.")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  const confirm =
    typeof body === "object" && body !== null && "confirm_org_name" in body
      ? String((body as { confirm_org_name: unknown }).confirm_org_name)
      : ""

  if (confirm.trim() !== profile.org_name) {
    return badRequest("confirm_org_name must exactly match the organisation name on the profile.")
  }

  deleteProfile(profile.id)
  try {
    await forgetListing(profile.id, profile.contact_email)
  } catch (error) {
    console.error("[durable] forget after delete failed", { id: profile.id }, error)
  }
  const res = ok({ deleted: true })
  await createSession(null, session.email, res.cookies)
  return res
}
