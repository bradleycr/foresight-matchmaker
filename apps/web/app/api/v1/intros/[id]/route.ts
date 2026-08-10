import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { introResponseSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { getIntro, respondToIntro } from "@/lib/db/intros"
import { getProfileById } from "@/lib/db/profiles"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/v1/intros/[id] — accept or decline a received introduction.
 *
 * Only the recipient can respond. Accepting reveals contact details to both
 * sides simultaneously (each side reads them via GET /api/v1/intros);
 * declining reveals nothing beyond the optional fixed-list reason.
 */
export async function PATCH(req: NextRequest, { params }: Params): Promise<Response> {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  const intro = getIntro(id)
  if (!intro) return notFound("No introduction with that id.")
  if (intro.toId !== session.profileId) {
    return forbidden("Only the recipient of an introduction can respond to it.")
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input
  try {
    input = introResponseSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  const result = respondToIntro(id, input.action, input.decline_reason)
  if (!result.ok) {
    return badRequest("This introduction is no longer open — it was already answered or has expired.")
  }

  // On accept, return the counterpart's contact block immediately so the
  // responding side does not need a second request.
  const counterpart = result.intro.state === "accepted" ? getProfileById(result.intro.fromId) : null

  return ok({
    intro: {
      id: result.intro.id,
      state: result.intro.state,
      responded_at: result.intro.respondedAt,
      ...(counterpart
        ? {
            counterpart_contact: {
              contact_name: counterpart.contact_name,
              contact_email: counterpart.contact_email,
              contact_role: counterpart.contact_role,
            },
          }
        : {}),
    },
  })
}
