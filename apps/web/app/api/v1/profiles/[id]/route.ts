import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { toPublicProfile } from "@rmm/schema"
import { profileInputSchema, outcomeSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, notFound, unauthorized, forbidden } from "@/lib/api/respond"
import {
  getProfileById,
  saveProfile,
  setJointApplicationOutcome,
  getJointApplicationOutcome,
  deleteProfile,
} from "@/lib/db/profiles"
import { destroySession, getSession } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/admin"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/v1/profiles/[id]
 *
 * The owner and the admin see the full profile. Everyone else sees the
 * redacted public shape — and only when visibility allows it.
 */
export async function GET(_req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params
  const profile = getProfileById(id)
  if (!profile) return notFound("No profile with that id.")

  const session = await getSession()
  const owner = session?.profileId === profile.id

  if (owner || (await isAdmin())) {
    return ok({
      profile,
      joint_application: getJointApplicationOutcome(profile.id),
    })
  }

  if (profile.visibility === "hidden") return notFound("No profile with that id.")
  if (profile.visibility === "authenticated_only" && !session) {
    return unauthorized("Sign in to view this profile.")
  }
  return ok({ profile: toPublicProfile(profile) })
}

/**
 * PATCH /api/v1/profiles/[id] — owner-only.
 *
 * Two payloads are accepted:
 *  - a full profile form (same shape as create; kind cannot change), or
 *  - `{ joint_application: "yes" | "no" | "not_yet" }` — the one-click KPI
 *    self-report.
 */
export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params
  const profile = getProfileById(id)
  if (!profile) return notFound("No profile with that id.")

  const session = await getSession()
  if (!session) return unauthorized()
  if (session.profileId !== profile.id) return forbidden("Only the profile owner can edit it.")

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
    return ok({ joint_application: outcome.data.joint_application })
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
    return badRequest("A profile cannot change kind. Create a new profile instead.")
  }

  const updated = saveProfile({
    ...input,
    id: profile.id,
    slug: profile.slug,
    created_at: profile.created_at,
    claimed_at: profile.claimed_at,
  })

  return ok({ profile: updated })
}

/**
 * DELETE /api/v1/profiles/[id] — owner-only GDPR erasure.
 *
 * Body must confirm with the exact organisation name:
 *   `{ "confirm_org_name": "…" }`
 * On success the profile and all linked personal data are removed and the
 * session cookie is cleared.
 */
export async function DELETE(req: NextRequest, { params }: Params): Promise<Response> {
  const { id } = await params
  const profile = getProfileById(id)
  if (!profile) return notFound("No profile with that id.")

  const session = await getSession()
  if (!session) return unauthorized()
  if (session.profileId !== profile.id) return forbidden("Only the profile owner can delete it.")

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
  await destroySession()
  return ok({ deleted: true })
}
