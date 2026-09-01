/**
 * Spotlight rotation is a pure function of the wall clock, which is what lets
 * the board count down honestly: the browser can work out when the next pair
 * lands without asking the server, and both arrive at the same answer.
 *
 * Kept free of imports on purpose — the countdown runs in the client bundle,
 * and the scoring in `spotlight.ts` reaches into the database.
 */

/** How long one pair holds the spotlight. Long enough to walk over and read it. */
export const SPOTLIGHT_MS = 40_000

export function msUntilNextSpotlight(nowMs: number = Date.now()): number {
  return SPOTLIGHT_MS - (nowMs % SPOTLIGHT_MS)
}

export function spotlightIndex(nowMs: number, pairCount: number): number {
  if (pairCount <= 0) return 0
  return Math.floor(nowMs / SPOTLIGHT_MS) % pairCount
}
