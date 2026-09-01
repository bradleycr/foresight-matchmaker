import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { onsiteCheckInSchema } from "@/lib/api/input"
import { ok, zodError, badRequest, unauthorized } from "@/lib/api/respond"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getSession } from "@/lib/auth/session"
import { hydrateEvents, hydrateListings } from "@/lib/db/durable"
import { flushEvent, listEvents, logEvent } from "@/lib/db/events"
import { isCheckedIn } from "@/lib/onsite/presence"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/onsite/check-in — “I’m here” for one city.
 * A listing is required. Hidden listings still record presence so staff
 * can see they arrived; the projector omits them.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const live = await peekLiveSession()
  if (!live) {
    const session = await getSession()
    if (!session) return unauthorized()
    return badRequest("Add a profile before checking in.")
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input
  try {
    input = onsiteCheckInSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  await Promise.all([hydrateListings(), hydrateEvents()])
  if (isCheckedIn(listEvents(), input.city, live.profile.id)) {
    return ok({ recorded: false, already: true, hidden: live.profile.visibility === "hidden" })
  }

  const event = logEvent("onsite_checkin", live.profile.id, {
    city: input.city,
    attending: live.profile.attending,
  })
  await flushEvent(event)
  return ok(
    { recorded: true, already: false, hidden: live.profile.visibility === "hidden" },
    { status: 201 },
  )
}
