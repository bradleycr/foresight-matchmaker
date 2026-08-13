import { CHALLENGE_ID, DEFAULT_CHALLENGE_ID, type ChallengeId } from "@rmm/schema"

/**
 * Foresight Matchmaking is the product. Challenges are programmes listed
 * on it — Recoding Medicine is the first. Copy lives in locales; this
 * catalog is the stable id / URL / host contract.
 */

export const PLATFORM = {
  id: "foresight",
  operator: "Foresight Institute",
  operatorUrl: "https://foresight.org",
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

export { CHALLENGE_ID, DEFAULT_CHALLENGE_ID }
export type { ChallengeId }
