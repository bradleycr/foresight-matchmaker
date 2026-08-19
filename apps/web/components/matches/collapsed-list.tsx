"use client"

import { useState, type ReactNode } from "react"

/**
 * Ranked list that opens at five entries so the first look is a shortlist,
 * not a wall. The rest stay one click away.
 */
export function CollapsedList({
  preview,
  rest,
  moreLabel,
}: {
  preview: ReactNode
  rest: ReactNode
  moreLabel: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <ol>
        {preview}
        {open ? rest : null}
      </ol>
      {!open && rest ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 min-h-11 border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {moreLabel}
        </button>
      ) : null}
    </>
  )
}
