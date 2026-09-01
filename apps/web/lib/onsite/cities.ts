import { RECODING_MATCHMAKING_EVENT_URLS } from "@/lib/challenges/catalog"

/**
 * In-person Recoding Medicine rooms. Slugs are the public URL segment
 * (`/live-feed/berlin`, `/here/berlin`) so printed QR codes stay stable
 * if we ever rename the attending chip.
 */

export const ONSITE_CITY_SLUGS = ["berlin", "paris", "stockholm"] as const
export type OnsiteCitySlug = (typeof ONSITE_CITY_SLUGS)[number]

export interface OnsiteCity {
  slug: OnsiteCitySlug
  attending: "event_sept_1" | "event_sept_2" | "event_sept_3"
  /** Civil date in Europe/Berlin, YYYY-MM-DD. */
  date: string
  luma: string
}

export const ONSITE_CITIES: readonly OnsiteCity[] = [
  {
    slug: "berlin",
    attending: "event_sept_1",
    date: "2026-09-02",
    luma: RECODING_MATCHMAKING_EVENT_URLS.event_sept_1,
  },
  {
    slug: "paris",
    attending: "event_sept_2",
    date: "2026-09-09",
    luma: RECODING_MATCHMAKING_EVENT_URLS.event_sept_2,
  },
  {
    slug: "stockholm",
    attending: "event_sept_3",
    date: "2026-09-17",
    luma: RECODING_MATCHMAKING_EVENT_URLS.event_sept_3,
  },
]

export function isOnsiteCitySlug(value: string | undefined | null): value is OnsiteCitySlug {
  return ONSITE_CITY_SLUGS.includes(value as OnsiteCitySlug)
}

export function onsiteCity(slug: string | undefined | null): OnsiteCity | undefined {
  if (!isOnsiteCitySlug(slug)) return undefined
  return ONSITE_CITIES.find((city) => city.slug === slug)
}

/** YYYY-MM-DD in the room's timezone — events are CET/CEST, not UTC. */
export function civilDateInBerlin(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

/**
 * Which room the projector should open. Before Paris's date we stay on
 * Berlin (including the day-before rehearsal). After Stockholm's date we
 * stay on Stockholm so the URL does not go blank.
 */
export function liveFeedCity(now = new Date()): OnsiteCitySlug {
  const today = civilDateInBerlin(now)
  if (today < ONSITE_CITIES[1]!.date) return "berlin"
  if (today < ONSITE_CITIES[2]!.date) return "paris"
  return "stockholm"
}
