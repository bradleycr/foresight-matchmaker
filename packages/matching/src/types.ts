import type { Profile, Dataset, DataNeeds } from "@rmm/schema"

/** One weighted factor's contribution to the final score. */
export interface Factor {
  key: string
  /** Maximum points this factor can contribute. */
  weight: number
  /** Points actually earned, 0..weight. */
  earned: number
  /** Human-readable, shown in the UI. */
  note: string
}

/** A blocker that reduces or eliminates a match. */
export interface Blocker {
  key: string
  /** `hard` forces score 0; `soft` is surfaced but does not zero the score. */
  severity: "hard" | "soft"
  note: string
}

/** The result of scoring an ordered pair (a, b). */
export interface ScoreResult {
  score: number
  factors: Factor[]
  blockers: Blocker[]
}

/** A ranked match entry produced by `topMatches`. */
export interface MatchEntry extends ScoreResult {
  /** id of the counterpart profile. */
  otherId: string
}

/**
 * The "data side" and "AI side" of a candidate pairing. A pairing has meaning
 * only when one side supplies data and the other supplies AI capability.
 * Consortia can occupy either side depending on what they are still seeking.
 */
export interface PairingSides {
  dataSide: Profile
  datasets: Dataset[]
  aiSide: Profile
  needs: DataNeeds
}

export type { Profile, Dataset, DataNeeds }
