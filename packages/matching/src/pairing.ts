import type { Profile, PairingSides } from "./types.js"
import { hasDatasets, hasAiFields } from "./helpers.js"

/**
 * Given two profiles, decide the data side and the AI side of the pairing.
 *
 * - data_holder ↔ ai_team: unambiguous.
 * - consortium ↔ ai_team / data_holder: the consortium fills whichever role
 *   the counterpart is missing.
 * - consortium ↔ consortium: use the first as data, second as AI (both carry
 *   both, so either orientation is valid; we pick a stable one).
 *
 * Returns null when no meaningful pairing exists (e.g. data_holder ↔
 * data_holder). The `score` function treats that as a same-kind hard blocker
 * rather than orienting here, so this only orients when at least one side has
 * datasets and at least one side has AI fields.
 */
export function orientPairing(a: Profile, b: Profile): PairingSides | null {
  const candidates: Array<[Profile, Profile]> = [
    [a, b],
    [b, a],
  ]

  for (const [dataSide, aiSide] of candidates) {
    if (hasDatasets(dataSide) && hasAiFields(aiSide)) {
      const datasets = (dataSide as Extract<Profile, { datasets: NonNullable<unknown> }>).datasets
      const needs = (aiSide as Extract<Profile, { data_needs: NonNullable<unknown> }>).data_needs
      return {
        dataSide,
        datasets: datasets as PairingSides["datasets"],
        aiSide,
        needs: needs as PairingSides["needs"],
      }
    }
  }
  return null
}
