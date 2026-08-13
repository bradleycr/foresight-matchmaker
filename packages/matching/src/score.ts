import type { Profile, ScoreResult, MatchEntry } from "./types"
import { orientPairing, orientPeoplePairing } from "./pairing"
import { computeBlockers, computePeopleBlockers, hasHardBlocker } from "./blockers"
import { computeFactors, computePeopleFactors, sumFactors } from "./factors"
import { consortiumIsSeeking } from "./helpers"

/**
 * Score an ordered pair of profiles.
 *
 * Pipeline:
 *   1. If either side is an individual, score a person↔team pairing
 *      (AI team or seeking consortium). Data holders are excluded.
 *   2. Otherwise orient data side + AI side. If no valid orientation
 *      exists, the pairing is structurally impossible.
 *   3. Collect blockers. Any HARD blocker forces score 0 (but every blocker,
 *      hard and soft, is still returned so the friction is visible).
 *   4. Otherwise sum the weighted soft factors into a 0–100 score.
 *
 * The function is pure and deterministic — identical inputs always produce an
 * identical result, which the test-suite relies on.
 */
export function score(a: Profile, b: Profile): ScoreResult {
  if (a.kind === "individual" || b.kind === "individual") {
    const people = orientPeoplePairing(a, b)
    const blockers = computePeopleBlockers(a, b, people)
    if (people === null || hasHardBlocker(blockers)) {
      return { score: 0, factors: [], blockers }
    }
    const factors = computePeopleFactors(people)
    const raw = sumFactors(factors)
    return { score: Math.max(0, Math.min(100, raw)), factors, blockers }
  }

  const oriented = orientPairing(a, b)
  const blockers = computeBlockers(a, b, oriented)

  if (oriented === null || hasHardBlocker(blockers)) {
    return { score: 0, factors: [], blockers }
  }

  const factors = computeFactors(oriented)
  const raw = sumFactors(factors)
  return { score: Math.max(0, Math.min(100, raw)), factors, blockers }
}

/**
 * Rank every candidate in `others` against `subject`, best first. Entries with
 * a hard blocker (score 0) are excluded by default; pass
 * `{ includeBlocked: true }` to keep them (the admin view uses this).
 */
export function topMatches(
  subject: Profile,
  others: readonly Profile[],
  opts: { limit?: number; includeBlocked?: boolean } = {},
): MatchEntry[] {
  const { limit = 10, includeBlocked = false } = opts

  // A consortium that is not seeking generates no outgoing matches.
  if (!consortiumIsSeeking(subject)) return []

  const entries: MatchEntry[] = []
  for (const other of others) {
    if (other.id === subject.id) continue
    const result = score(subject, other)
    if (!includeBlocked && result.score === 0) continue
    entries.push({ ...result, otherId: other.id })
  }

  entries.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score
    // Deterministic tie-break by id so ordering is stable.
    return x.otherId < y.otherId ? -1 : x.otherId > y.otherId ? 1 : 0
  })

  return entries.slice(0, limit)
}
