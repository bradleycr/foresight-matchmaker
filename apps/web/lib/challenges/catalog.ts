import { CHALLENGE_ID, DEFAULT_CHALLENGE_ID, type ChallengeId } from "@rmm/schema"

/**
 * Foresight Matchmaking is the product. Challenges are programmes listed
 * on it — Recoding Medicine is the first. Copy lives in locales; this
 * catalog is the stable id / URL / host contract. Per-programme colour
 * washes live in `./themes.ts`.
 */

export const PLATFORM = {
  id: "foresight",
  operator: "Foresight Institute",
  operatorUrl: "https://foresight.org",
  /** Matchmaking sessions, webinars, and Foresight community events. */
  lumaCalendarUrl: "https://luma.com/foresightinstitute",
} as const

export interface ChallengeDef {
  id: ChallengeId
  slug: string
  host: string
  hostUrl: string
  hostEmail: string
  deadlineLabel: string
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: "recoding_medicine",
    slug: "recoding-medicine",
    host: "SPRIND",
    hostUrl: "https://www.sprind.org/taten/challenges/recoding-medicine",
    /** Application inbox for the programme — never shown as a directory contact. */
    hostEmail: "challenge@sprind.org",
    deadlineLabel: "16 October 2026, 18:00 CET",
  },
]

export function challengeIdOf(id: string | undefined | null): ChallengeId {
  return CHALLENGE_ID.includes(id as ChallengeId) ? (id as ChallengeId) : DEFAULT_CHALLENGE_ID
}

export function challengeById(id: string | undefined | null): ChallengeDef {
  return CHALLENGES.find((c) => c.id === challengeIdOf(id)) ?? CHALLENGES[0]!
}

export function challengeBySlug(slug: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.slug === slug)
}

/** Directory URL for one programme. */
export function directoryHref(challengeId: ChallengeId): string {
  return `/directory?challenge=${challengeId}`
}

/**
 * Where Browse / Directory should land.
 *
 * Signed-in listers go to the programme on their listing. With a single
 * open programme (today: Recoding Medicine) everyone else lands there too.
 * Several programmes and no listing yet → `/directory` (the chooser).
 */
export function browseDirectoryPath(listingChallengeId?: string | null): string {
  const listed = listingChallengeId
    ? CHALLENGES.find((c) => c.id === listingChallengeId)
    : undefined
  if (listed) return directoryHref(listed.id)
  if (CHALLENGES.length === 1) return directoryHref(CHALLENGES[0]!.id)
  return "/directory"
}

/** In-person Recoding Medicine matchmaking — dates align with `enum.attending` chips. */
export const RECODING_MATCHMAKING_EVENTS = [
  "event_sept_1",
  "event_sept_2",
  "event_sept_3",
] as const

/** Per-city Luma pages. The calendar URL above stays the full Foresight listing. */
export const RECODING_MATCHMAKING_EVENT_URLS: Record<(typeof RECODING_MATCHMAKING_EVENTS)[number], string> = {
  event_sept_1: "https://luma.com/foresight-bmzq",
  event_sept_2: "https://luma.com/foresight-hf6t",
  event_sept_3: "https://luma.com/y9aqjbzq",
}

export { CHALLENGE_ID, DEFAULT_CHALLENGE_ID }
export type { ChallengeId }
