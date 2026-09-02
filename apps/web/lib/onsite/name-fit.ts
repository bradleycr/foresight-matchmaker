/**
 * Room tiles are fixed cells on a projector, so a long legal name has to
 * shrink rather than clip. Steps are coarse on purpose: four sizes read as a
 * deliberate hierarchy from across the room, a continuous scale does not.
 *
 * Two things make a name expensive, and the worse one wins: how long it is
 * overall, and how long its longest unbreakable word is. German compounds
 * like "Datenintegrationszentrum" fit the first test and fail the second.
 */
const TILE_STEPS = [
  "text-[clamp(0.85rem,1.5vw,1.35rem)]",
  "text-[clamp(0.75rem,1.2vw,1.05rem)]",
  "text-[clamp(0.68rem,1vw,0.9rem)]",
  "text-[clamp(0.6rem,0.85vw,0.78rem)]",
] as const

export function longestWordLength(value: string): number {
  return value
    .split(/[\s—–-]+/)
    .reduce((longest, word) => Math.max(longest, word.length), 0)
}

function stepForTotal(length: number): number {
  if (length <= 20) return 0
  if (length <= 34) return 1
  if (length <= 48) return 2
  return 3
}

function stepForWord(length: number): number {
  if (length <= 10) return 0
  if (length <= 14) return 1
  if (length <= 18) return 2
  return 3
}

export function tileNameClass(orgName: string, opts?: { withFooter?: boolean }): string {
  const name = orgName.trim()
  let step = Math.max(stepForTotal(name.length), stepForWord(longestWordLength(name)))
  if (opts?.withFooter && step < TILE_STEPS.length - 1) step += 1
  return TILE_STEPS[step]!
}

/** Starting pixel size before auto-fit walks down. */
const TILE_MAX_PX = [18, 15, 12, 10] as const

export function tileNameMaxPx(orgName: string, opts?: { withFooter?: boolean }): number {
  const name = orgName.trim()
  let step = Math.max(stepForTotal(name.length), stepForWord(longestWordLength(name)))
  if (opts?.withFooter && step < TILE_MAX_PX.length - 1) step += 1
  return TILE_MAX_PX[step] ?? 10
}

/** Same idea for the two large “should talk” cards. */
export function pairNameClass(orgName: string): string {
  const name = orgName.trim()
  if (name.length <= 24 && longestWordLength(name) <= 14) return "text-3xl"
  if (name.length <= 40) return "text-2xl"
  return "text-xl"
}

export function pairNameMaxPx(orgName: string): number {
  const name = orgName.trim()
  if (name.length <= 24 && longestWordLength(name) <= 14) return 30
  if (name.length <= 40) return 24
  return 20
}
