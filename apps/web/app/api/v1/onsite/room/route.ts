import { NextRequest } from "next/server"
import { ok, badRequest, unauthorized } from "@/lib/api/respond"
import { resolveLiveSession } from "@/lib/auth/live-session"
import { hydrateEvents, hydrateListings } from "@/lib/db/durable"
import { listEvents } from "@/lib/db/events"
import { getShortlist } from "@/lib/db/matches"
import { listProfiles } from "@/lib/db/profiles"
import { isOnsiteCitySlug, liveFeedCity } from "@/lib/onsite/cities"
import { getT } from "@/lib/i18n/server"
import { buildOnsiteRoom } from "@/lib/onsite/room"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/onsite/room?city=stockholm — the phone board.
 *
 * Signed-in counterpart to the public projector feed: same presence data,
 * but intersected with the caller's own shortlist. A listing is required,
 * because "your matches here" is meaningless without one.
 *
 * Deliberately silent in the event ledger. Phones poll this every few
 * seconds for the length of an evening; logging a view per poll would bury
 * the real signal in the log.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const raw = req.nextUrl.searchParams.get("city")
  if (raw && !isOnsiteCitySlug(raw)) return badRequest("Unknown room.")
  const city = isOnsiteCitySlug(raw) ? raw : liveFeedCity()

  const live = await resolveLiveSession()
  if (!live) return unauthorized()

  const { t } = await getT()
  // Listings keep the standard debounce; events refresh faster so a new
  // arrival reaches every isolate without re-pulling the whole corpus.
  await Promise.all([hydrateListings(), hydrateEvents({ maxStaleMs: 30_000 })])

  return ok(
    buildOnsiteRoom({
      city,
      viewerId: live.profile.id,
      profiles: listProfiles(),
      events: listEvents(),
      shortlist: getShortlist(live.profile.id),
      t,
    }),
  )
}
