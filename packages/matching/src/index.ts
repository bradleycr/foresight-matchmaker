export { score, topMatches } from "./score"
export { computeBlockers, hasHardBlocker } from "./blockers"
export { computeFactors, sumFactors } from "./factors"
export { orientPairing } from "./pairing"
export { jaccard, overlaps, unique, consortiumIsSeeking, hasDatasets, hasAiFields } from "./helpers"
export type {
  Factor,
  Blocker,
  ScoreResult,
  MatchEntry,
  PairingSides,
  Profile,
  Dataset,
  DataNeeds,
} from "./types"
