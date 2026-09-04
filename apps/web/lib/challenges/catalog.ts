import { CHALLENGE_ID, DEFAULT_CHALLENGE_ID, type Attending, type ChallengeId } from "@rmm/schema"

/**
 * Foresight Matchmaking is the product. Challenges are programmes listed
 * on it — Recoding Medicine is the first, AI Safety Berlin the second.
 * Copy lives in locales; this catalog is the stable id / URL / host
 * contract. Per-programme colour washes live in `./themes.ts`, and who is
 * allowed to see an unlaunched programme lives in `./visibility.ts`.
 */

export const PLATFORM = {
  id: "foresight",
  operator: "Foresight Institute",
  operatorUrl: "https://foresight.org",
  /** Matchmaking sessions, webinars, and Foresight community events. */
  lumaCalendarUrl: "https://luma.com/foresightinstitute",
} as const

/**
 * `open` is listed for everyone. `preview` is built but not launched: it is
 * reachable only where previews are enabled, so a programme can be filled in
 * and demoed months before it goes public. Launching one is this single word.
 */
export type ChallengeStatus = "open" | "preview"

export interface ChallengeDef {
  id: ChallengeId
  slug: string
  status: ChallengeStatus
  host: string
  hostUrl: string
  hostEmail: string
  /**
   * Programmes that close. Rolling ones leave this unset and describe their
   * rhythm in `challenge.{id}.cadence` instead.
   */
  deadlineLabel?: string
  /** Where this programme publishes its sessions. */
  calendarUrl: string
  /**
   * Fact rows on the programme page, in order. Each key resolves to
   * `{factsNamespace}.fact_{key}_label` for the term and
   * `{factsNamespace}.fact_{key}` for the value, so translators own the copy
   * and this file owns the ordering.
   */
  factsNamespace: string
  factKeys: readonly string[]
  /**
   * Sessions listed on the programme page, in order. These are `attending`
   * chips, so the page and the profile form can never drift apart on which
   * rooms a programme actually runs.
   */
  sessions: readonly Attending[]
  /** Per-session pages. Any session left out falls back to `calendarUrl`. */
  sessionUrls?: Partial<Record<Attending, string>>
}

/** In-person Recoding Medicine matchmaking — dates align with `enum.attending` chips. */
export const RECODING_MATCHMAKING_EVENTS = [
  "event_sept_1",
  "event_sept_2",
  "event_sept_3",
] as const

/** Per-city Luma pages. The platform calendar stays the full Foresight listing. */
export const RECODING_MATCHMAKING_EVENT_URLS: Record<(typeof RECODING_MATCHMAKING_EVENTS)[number], string> = {
  event_sept_1: "https://luma.com/foresight-bmzq",
  event_sept_2: "https://luma.com/foresight-hf6t",
  event_sept_3: "https://luma.com/y9aqjbzq",
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: "recoding_medicine",
    slug: "recoding-medicine",
    status: "open",
    host: "SPRIND",
    hostUrl: "https://www.sprind.org/taten/challenges/recoding-medicine",
    /** Application inbox for the programme — never shown as a directory contact. */
    hostEmail: "challenge@sprind.org",
    deadlineLabel: "16 October 2026, 18:00 CET",
    calendarUrl: PLATFORM.lumaCalendarUrl,
    factsNamespace: "landing",
    factKeys: ["deadline", "webinar", "stages", "funding", "hq", "dataset"],
    sessions: RECODING_MATCHMAKING_EVENTS,
    sessionUrls: RECODING_MATCHMAKING_EVENT_URLS,
  },
  {
    /**
     * AI Safety Berlin — a standing community rather than a call for
     * applications, so it has no deadline and its rooms recur. It coworks
     * from the Æthos space in CIC Berlin, next door to Foresight's Berlin
     * node. Preview until the October launch.
     */
    id: "ai_safety_berlin",
    slug: "ai-safety-berlin",
    status: "preview",
    host: "AI Safety Berlin",
    hostUrl: "https://aisafety.berlin",
    hostEmail: "contact@aisafety.berlin",
    calendarUrl: "https://luma.com/AISafetyBerlin",
    factsNamespace: "challenge.ai_safety_berlin",
    factKeys: ["cadence", "venue", "format", "cost", "who"],
    sessions: ["asb_coworking", "asb_lunch", "asb_talks"],
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

/** Page for one session chip; programmes without per-session pages link their calendar. */
export function sessionUrl(challenge: ChallengeDef, session: Attending): string {
  return challenge.sessionUrls?.[session] ?? challenge.calendarUrl
}

/** Directory URL for one programme. */
export function directoryHref(challengeId: ChallengeId): string {
  return `/directory?challenge=${challengeId}`
}

/** Recoding Medicine is a call for applications. Community programmes are not. */
export function isApplicationChallenge(id: ChallengeId): boolean {
  return id === "recoding_medicine"
}

export { CHALLENGE_ID, DEFAULT_CHALLENGE_ID }
export type { ChallengeId }
