import type { Profile } from "@rmm/schema"
import type { EventRow } from "@/lib/db/events"
import type { OnsiteCitySlug } from "./cities"
import type { OnsiteCard } from "./types"

/**
 * Who tapped “I’m here” for this city. First check-in wins so a second
 * scan does not shuffle the board. Hidden listings stay in the map —
 * the feed filters them before they hit the projector.
 */
export function checkInsForCity(events: readonly EventRow[], city: OnsiteCitySlug): Map<string, string> {
  const byId = new Map<string, string>()
  for (const event of events) {
    if (event.type !== "onsite_checkin") continue
    if (event.payload.city !== city) continue
    if (!event.actorId) continue
    const previous = byId.get(event.actorId)
    if (!previous || event.createdAt < previous) byId.set(event.actorId, event.createdAt)
  }
  return byId
}

export function isCheckedIn(events: readonly EventRow[], city: OnsiteCitySlug, profileId: string): boolean {
  return checkInsForCity(events, city).has(profileId)
}

function lookingForLabels(profile: Profile, t: (key: string) => string): string[] {
  return profile.looking_for
    .filter((value) => value !== "not_looking")
    .map((value) => t(`enum.looking_for.${value}`))
}

export function cardFromProfile(profile: Profile, arrivedAt: string, t: (key: string) => string): OnsiteCard {
  return {
    id: profile.id,
    org_name: profile.org_name,
    kind: profile.kind,
    kind_label: t(`enum.kind.${profile.kind}`),
    one_liner: profile.one_liner,
    looking_for: lookingForLabels(profile, t),
    arrived_at: arrivedAt,
  }
}

/** First check-in top-left; new arrivals fill left-to-right, top-down. */
export function presentCards(
  profiles: readonly Profile[],
  checkIns: ReadonlyMap<string, string>,
  t: (key: string) => string,
): OnsiteCard[] {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))
  const cards: OnsiteCard[] = []
  for (const [id, arrivedAt] of checkIns) {
    const profile = byId.get(id)
    if (!profile) continue
    if (profile.visibility === "hidden") continue
    cards.push(cardFromProfile(profile, arrivedAt, t))
  }
  cards.sort((a, b) => (a.arrived_at > b.arrived_at ? 1 : a.arrived_at < b.arrived_at ? -1 : a.org_name.localeCompare(b.org_name)))
  return cards
}
