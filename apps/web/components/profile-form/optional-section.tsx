"use client"

import { cn } from "@/lib/utils"

/**
 * Collapsed optional block. Title + a quiet count — no explainer copy.
 * Controlled so Remmy or a validation error can open the right group.
 */
export function OptionalSection({
  id,
  title,
  filled,
  total,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  filled?: number
  total?: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const count =
    total != null && total > 0 ? (
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
        {filled ?? 0}/{total}
      </span>
    ) : null

  return (
    <section className="border border-rule-strong bg-paper">
      <h2 className="m-0">
        <button
          type="button"
          id={id}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="font-listing text-sm font-bold uppercase tracking-wide">{title}</span>
          <span className="flex items-center gap-3">
            {count}
            <span aria-hidden="true" className="text-ink-soft">
              {open ? "−" : "+"}
            </span>
          </span>
        </button>
      </h2>
      <div
        id={`${id}-body`}
        hidden={!open}
        className={cn("flex flex-col gap-4 border-t border-rule px-4 py-4", !open && "hidden")}
      >
        {children}
      </div>
    </section>
  )
}
