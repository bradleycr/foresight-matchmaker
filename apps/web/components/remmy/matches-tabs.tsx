import type { ReactNode } from "react"

/**
 * Ranked list is the matches surface. Remmy for listing edits stays on /me.
 */
export function MatchesTabs({ list }: { list: ReactNode }) {
  return <div className="mt-6">{list}</div>
}
