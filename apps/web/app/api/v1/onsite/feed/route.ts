import { NextRequest } from "next/server"
import { ok, badRequest } from "@/lib/api/respond"
import { getT } from "@/lib/i18n/server"
import { hydrateEvents, hydrateListings } from "@/lib/db/durable"
import { listEvents } from "@/lib/db/events"
import { listProfiles } from "@/lib/db/profiles"
import { isOnsiteCitySlug, liveFeedCity } from "@/lib/onsite/cities"
import { buildOnsiteFeed } from "@/lib/onsite/feed"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/onsite/feed?city=berlin — projector payload.
 * Public on purpose: the room screen has no session. Cards never include
 * emails or other private fields.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const raw = req.nextUrl.searchParams.get("city")
  const city = isOnsiteCitySlug(raw) ? raw : liveFeedCity()
  if (raw && !isOnsiteCitySlug(raw)) return badRequest("Unknown room.")

  const { t } = await getT()
  await Promise.all([hydrateListings(), hydrateEvents()])
  return ok(buildOnsiteFeed(city, listProfiles(), listEvents(), t))
}
