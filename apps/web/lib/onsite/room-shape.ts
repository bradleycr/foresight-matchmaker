/** Equal cells so the room wall fills one HDMI frame — no scroll. */
export function roomShape(count: number): { cols: number; rows: number } {
  if (count <= 0) return { cols: 1, rows: 1 }
  const cols = count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : count <= 25 ? 5 : 6
  return { cols, rows: Math.ceil(count / cols) }
}
