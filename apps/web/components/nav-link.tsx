"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Nanowheel } from "@/components/nanowheel"
import { isActiveHref } from "@/lib/nav/active-href"
import { cn } from "@/lib/utils"

/**
 * Header/footer Link.
 *
 * Active text nav: ink underline + a still nanowheel (Foresight chrome only).
 * Exact path only — `/me/matches` does not light “Your listing”.
 */
export function NavLink({
  href,
  className,
  children,
  showMark = true,
  markActive = true,
  prefetch = true,
}: {
  href: string
  className?: string
  children: React.ReactNode
  /** Show the nanowheel beside an active route. Off for the brand lockup. */
  showMark?: boolean
  /** Paint active styles. Off for the brand home link. */
  markActive?: boolean
  prefetch?: boolean
}) {
  const pathname = usePathname()
  const active = markActive && isActiveHref(pathname, href)

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5",
        active && "underline decoration-ink decoration-2 underline-offset-4",
        className,
      )}
    >
      {children}
      {showMark && active ? <Nanowheel size="xs" className="opacity-90" /> : null}
    </Link>
  )
}
