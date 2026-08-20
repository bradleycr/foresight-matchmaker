"use client"

import { useState, type ReactNode } from "react"
import { useT } from "@/lib/i18n/client"

export const MATCHES_PAGE_SIZE = 5

/**
 * Ranked shortlist in pages of five. Label copy lives here so the parent
 * Server Component never has to pass a function across the client boundary.
 */
export function CollapsedList({
  items,
  pageSize = MATCHES_PAGE_SIZE,
}: {
  items: ReactNode[]
  pageSize?: number
}) {
  const t = useT()
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
          {t("matches.show_more", { n: nextChunk })}
        </button>
      ) : null}
    </>
  )
}
