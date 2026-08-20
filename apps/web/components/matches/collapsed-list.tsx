"use client"

import { useState, type ReactNode } from "react"

export const MATCHES_PAGE_SIZE = 5

/**
 * Ranked shortlist in pages of five. First look is the top five above
 * threshold; each click reveals the next page, never a wall of scores.
 */
export function CollapsedList({
  items,
  pageSize = MATCHES_PAGE_SIZE,
  moreLabel,
}: {
  items: ReactNode[]
  pageSize?: number
  moreLabel: (n: number) => string
}) {
  const [shown, setShown] = useState(() => Math.min(pageSize, items.length))
  const remaining = items.length - shown
  const nextChunk = remaining > 0 ? Math.min(pageSize, remaining) : 0

  return (
    <>
      <ol>{items.slice(0, shown)}</ol>
      {nextChunk > 0 ? (
        <button
          type="button"
          onClick={() => setShown((n) => Math.min(n + pageSize, items.length))}
          className="mt-4 min-h-11 border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {moreLabel(nextChunk)}
        </button>
      ) : null}
    </>
  )
}
