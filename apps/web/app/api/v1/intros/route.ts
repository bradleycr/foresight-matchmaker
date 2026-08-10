import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { introRequestSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized, notFound, tooMany } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { getProfileById } from "@/lib/db/profiles"
import { listIntrosFor, requestIntro, rateLimitPer24h, type Intro } from "@/lib/db/intros"

export const dynamic = "force-dynamic"

/**
 * The intro payload each side sees. Contact details appear ONLY on accepted
 * intros, read fresh from the counterpart profile at request time —
 * `requested` and `declined` states reveal nothing.
 */
function serialiseIntro(intro: Intro, viewerId: string) {
  const counterpartId = intro.fromId === viewerId ? intro.toId : intro.fromId
  const counterpart = getProfileById(counterpartId)

  return {
    id: intro.id,
    direction: intro.fromId === viewerId ? "sent" : "received",
    state: intro.state,
    message: intro.message,
    decline_reason: intro.declineReason,
    created_at: intro.createdAt,
    responded_at: intro.respondedAt,
    expires_at: intro.expiresAt,
    counterpart: counterpart
      ? {
          id: counterpart.id,
          slug: counterpart.slug,
          kind: counterpart.kind,
          org_name: counterpart.org_name,
          country: counterpart.country,
          one_liner: counterpart.one_liner,
          // The double opt-in reveal: both sides, simultaneously, server-side.
          ...(intro.state === "accepted"
            ? {
                contact_name: counterpart.contact_name,
                contact_email: counterpart.contact_email,
                contact_role: counterpart.contact_role,
              }
            : {}),
        }
      : null,
  }
}

/** GET /api/v1/intros — everything sent or received by the signed-in profile. */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  const intros = listIntrosFor(session.profileId).map((i) => serialiseIntro(i, session.profileId))
  return ok({ intros })
}

/** POST /api/v1/intros — request an introduction (≤500 chars, 5/day). */
export async function POST(req: NextRequest): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input
  try {
    input = introRequestSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  const target = getProfileById(input.to_id)
  if (!target || target.visibility === "hidden") return notFound("That profile does not exist.")
  if (!target.open_to_intros) {
    return badRequest("This organisation is not accepting introduction requests.")
  }

  const result = requestIntro(session.profileId, input.to_id, input.message)
  if (!result.ok) {
    switch (result.error) {
      case "rate_limited":
        return tooMany(
          `You have sent ${rateLimitPer24h()} introduction requests in the last 24 hours. Try again later.`,
        )
      case "duplicate_pending":
        return badRequest("There is already an open introduction between you and this organisation.")
      case "self_intro":
        return badRequest("You cannot request an introduction to your own profile.")
    }
  }

  return ok({ intro: serialiseIntro(result.intro, session.profileId) }, { status: 201 })
}
