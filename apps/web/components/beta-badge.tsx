import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Tiny gold flag for the masthead lockup. Sits beside the product title so
 * the Foresight wordmark itself is never branded as unfinished.
 */
export function BetaBadge({
  children = "Beta",
  className = "",
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center self-center border border-ink bg-mark px-1.5 py-px",
        "font-sans text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-mark-ink",
        className,
      )}
    >
      {children}
    </span>
  )
}
