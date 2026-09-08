/** Below this, tiles keep a poster size and sit as a cluster — they do not grow to fill the HDMI frame. */
export const SPARSE_ROOM_MAX = 4

export function isSparseRoom(count: number): boolean {
  return count > 0 && count <= SPARSE_ROOM_MAX
}

/**
 * Equal cells so a busy room fills one HDMI frame — no scroll.
 *
 * A nearly empty room used to use the same `1fr` stretch, so one or two
 * people became posters the size of the wall. Sparse counts keep a compact
 * cluster; five and up still pack the frame.
 */
export function roomShape(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 3, rows: 2 }
  if (isSparseRoom(count)) {
    if (count <= 2) return { cols: count, rows: 1 }
    return { cols: 2, rows: 2 }
  }
  const cols = count <= 9 ? 3 : count <= 16 ? 4 : count <= 25 ? 5 : 6
  return { cols, rows: Math.ceil(count / cols) }
}
