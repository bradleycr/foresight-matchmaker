export { score, topMatches } from "./score"
export { computeBlockers, computePeopleBlockers, hasHardBlocker } from "./blockers"
export { computeFactors, computePeopleFactors, sumFactors } from "./factors"
export { orientPairing, orientPeoplePairing } from "./pairing"
export { jaccard, overlaps, unique, consortiumIsSeeking, hasDatasets, hasAiFields } from "./helpers"
export type {
  Factor,
  Blocker,
  ScoreResult,
  MatchEntry,
  PairingSides,
  PeoplePairingSides,
  Profile,
  Dataset,
  DataNeeds,
} from "./types"
