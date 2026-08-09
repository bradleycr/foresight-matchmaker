export { score, topMatches } from "./score.js"
export { computeBlockers, hasHardBlocker } from "./blockers.js"
export { computeFactors, sumFactors } from "./factors.js"
export { orientPairing } from "./pairing.js"
export { jaccard, overlaps, unique, consortiumIsSeeking, hasDatasets, hasAiFields } from "./helpers.js"
export type {
  Factor,
  Blocker,
  ScoreResult,
  MatchEntry,
  PairingSides,
  Profile,
  Dataset,
  DataNeeds,
} from "./types.js"
