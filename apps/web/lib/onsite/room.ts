import type { Factor } from "@rmm/matching"
import type { Profile } from "@rmm/schema"
import type { EventRow } from "@/lib/db/events"
import type { T } from "@/lib/i18n"
import type { OnsiteCitySlug } from "./cities"
import { cardFromProfile, checkInsForCity } from "./presence"
import type { OnsiteCard, OnsiteRoom, OnsiteRoomMatch } from "./types"

/**
 * The phone half of the room board.
 *
 * The projector answers "who is here". Standing in the room, the only
 * question that matters is "who here should I talk to", and the shortlist
 * already knows. This module intersects the two: presence from the event
 * ledger, ranking from the cached match rows. No scoring happens here —
 * a phone must not pay for what the shortlist has already computed.
 */

/** Factor labels per card. Three is a paragraph on a phone; two scans. */
const REASON_COUNT = 2

/** The shortlist fields this module needs — a narrow view of `CachedMatch`. */
export interface RoomShortlistEntry {
  otherId: string
  score: number
  factors: Factor[]
}

/**
 * The strongest factors behind one pairing.
 *
 * Ranked by proportion earned, not raw points: a small factor fully met says
 * more about why two people should talk than a large one scraping half.
 */
export function matchReasons(factors: readonly Factor[], t: T): string[] {
  return factors
    .filter((factor) => factor.weight > 0 && factor.earned > 0)
    .map((factor) => ({ key: factor.key, ratio: factor.earned / factor.weight }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, REASON_COUNT)
    .map((factor) => t(`factor.${factor.key}`))
}

/** First arrival first, then alphabetical — the same order as the wall. */
function byArrival(
  a: { profile: Profile; arrivedAt: string },
  b: { profile: Profile; arrivedAt: string },
): number {
  if (a.arrivedAt !== b.arrivedAt) return a.arrivedAt < b.arrivedAt ? -1 : 1
  return a.profile.org_name.localeCompare(b.profile.org_name)
}

export function buildOnsiteRoom({
  city,
  viewerId,
  profiles,
  events,
  shortlist,
  t,
}: {
  city: OnsiteCitySlug
  viewerId: string
  profiles: readonly Profile[]
  events: readonly EventRow[]
  /** Already filtered to score ≥ MIN_SCORE and unblocked by `getShortlist`. */
  shortlist: readonly RoomShortlistEntry[]
  t: T
}): OnsiteRoom {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))

  // Hidden listings record presence so staff can see arrivals, but they are
  // not on the wall and must not appear on a peer's phone either.
  const present: { profile: Profile; arrivedAt: string }[] = []
  for (const [id, arrivedAt] of checkInsForCity(events, city)) {
    const profile = byId.get(id)
    if (!profile) continue
    if (profile.visibility === "hidden") continue
    present.push({ profile, arrivedAt })
  }
  present.sort(byArrival)

  const arrivedById = new Map(present.map((entry) => [entry.profile.id, entry.arrivedAt]))

  const everyone: OnsiteCard[] = present
    .filter((entry) => entry.profile.id !== viewerId)
    .map((entry) => cardFromProfile(entry.profile, entry.arrivedAt, t))

  const matches: OnsiteRoomMatch[] = shortlist.flatMap((entry) => {
    if (entry.otherId === viewerId) return []
    const arrivedAt = arrivedById.get(entry.otherId)
    if (!arrivedAt) return []
    const profile = byId.get(entry.otherId)
    if (!profile) return []
    return [
      {
        ...cardFromProfile(profile, arrivedAt, t),
        score: entry.score,
        reasons: matchReasons(entry.factors, t),
      },
    ]
  })
  matches.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.org_name.localeCompare(b.org_name)))

  return {
    city,
    city_label: t(`onsite.city.${city}`),
    // Counts the viewer, so the phone and the projector never disagree.
    count: present.length,
    matches,
    everyone,
  }
}
