import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { introRequestSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized, notFound, tooMany } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { getProfileById } from "@/lib/db/profiles"
import { hydrateListings, restoreOwnedProfile } from "@/lib/db/durable"
import { listIntrosFor, requestIntro, rateLimitPer24h, type Intro } from "@/lib/db/intros"
import { sendIntroductionEmail } from "@/lib/auth/mail"

export const dynamic = "force-dynamic"

const CONTACT_STATES = new Set(["emailed", "accepted"])

/**
 * Contacts log. Emails are on the record once an introduction has been
 * forwarded (`emailed`) or, for leftover rows, accepted.
 */
function serialiseIntro(intro: Intro, viewerId: string) {
  const counterpartId = intro.fromId === viewerId ? intro.toId : intro.fromId
  const counterpart = getProfileById(counterpartId)
  const reveal = CONTACT_STATES.has(intro.state)

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
          ...(reveal
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

/** GET /api/v1/intros — sent and received contacts for the signed-in profile. */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session?.profileId) return unauthorized()
  await hydrateListings()
  const viewerId = session.profileId

  const intros = listIntrosFor(viewerId).map((i) => serialiseIntro(i, viewerId))
  return ok({ intros })
}

/**
 * POST /api/v1/intros — email an introduction (≤500 chars, rate-limited).
 * The conversation continues in ordinary email; this site keeps a record.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const session = await getSession()
  if (!session?.profileId) return unauthorized()
  const viewerId = session.profileId
  await restoreOwnedProfile(viewerId, session.email)
  await restoreOwnedProfile(null, session.email)

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

  await restoreOwnedProfile(input.to_id, session.email)

  const sender = getProfileById(viewerId)
  const target = getProfileById(input.to_id)
  if (!sender) return unauthorized()
  if (!target || target.visibility === "hidden") return notFound("That profile does not exist.")
  if (!target.open_to_intros) {
    return badRequest("This organisation is not accepting introductions.")
  }

  const result = requestIntro(viewerId, input.to_id, input.message)
  if (!result.ok) {
    switch (result.error) {
      case "rate_limited":
        return tooMany(
          `You have sent ${rateLimitPer24h()} introductions in the last 24 hours. Try again later.`,
        )
      case "already_contacted":
        return badRequest("You have already contacted this organisation. Continue by email — the record is in Contacts.")
      case "self_intro":
        return badRequest("You cannot introduce yourself to your own profile.")
    }
  }

  const origin = process.env.APP_URL ?? req.nextUrl.origin
  const mail = await sendIntroductionEmail({
    from: sender,
    to: target,
    message: input.message,
    fromProfileUrl: `${origin}/profile/${sender.slug}`,
  })

  return ok(
    {
      intro: serialiseIntro(result.intro, viewerId),
      email_sent: mail.sent,
    },
    { status: 201 },
  )
}
