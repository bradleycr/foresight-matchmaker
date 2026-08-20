import { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import { ZodError } from "zod"
import { contactClickSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized, notFound } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { getProfileById } from "@/lib/db/profiles"
import { hydrateListings, hydrateEvents } from "@/lib/db/durable"
import { flushEvent, listEvents, logEvent } from "@/lib/db/events"

export const dynamic = "force-dynamic"

function sessionActorId(session: { profileId: string | null; email: string }): string {
  if (session.profileId) return session.profileId
  return `anon:${createHash("sha256").update(session.email.toLowerCase()).digest("hex").slice(0, 24)}`
}

/**
 * POST /api/v1/contact-events — a member opened email or LinkedIn on a listing.
 * That click is the introduction now that this site no longer sends messages.
 */
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
    input = contactClickSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  if (session.profileId && session.profileId === input.to_id) {
    return ok({ recorded: false, self: true })
  }

  await hydrateListings()
  const target = getProfileById(input.to_id)
  if (!target || target.visibility === "hidden") return notFound("That profile does not exist.")
  if (!target.open_to_intros) {
    return badRequest("This organisation is not accepting introductions.")
  }

  const actorId = sessionActorId(session)
  await hydrateEvents()
  const already = listEvents().some(
    (e) =>
      e.type === "intro_requested" &&
      e.actorId === actorId &&
      e.payload.to === input.to_id &&
      e.payload.channel === input.channel,
  )
  if (already) return ok({ recorded: false, already: true })

  const event = logEvent("intro_requested", actorId, { to: input.to_id, channel: input.channel })
  await flushEvent(event)
  return ok({ recorded: true }, { status: 201 })
}
