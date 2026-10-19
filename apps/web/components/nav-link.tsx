"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Nanowheel } from "@/components/nanowheel"
import { cn } from "@/lib/utils"

/**
 * Header/footer Link.
 *
 * Active text nav: ink underline + a still nanowheel (Foresight chrome only).
 * No click-flash spinner — that read as a mystery glyph that vanished.
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

/**
 * Route match for nav chrome. Hash-only home links (`/#programmes`) are never
 * “current” — they would otherwise light up on every visit to `/`.
 */
function isActiveHref(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  const hashAt = href.indexOf("#")
  if (hashAt === 0 || (hashAt === 1 && href.startsWith("/#"))) return false
  const path = (hashAt >= 0 ? href.slice(0, hashAt) : href).split("?")[0] ?? href
  if (!path || path === "/") return pathname === "/"
  return pathname === path || pathname.startsWith(`${path}/`)
}
