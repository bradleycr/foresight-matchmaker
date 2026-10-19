"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { Nanowheel } from "@/components/nanowheel"
import { cn } from "@/lib/utils"

/**
 * Header/footer Link. Pending navigation spins a nanowheel; text nav items
 * get an ink underline when active. The brand home link opts out — underlining
 * the whole masthead looked like stray rules.
 */
export function NavLink({
  href,
  className,
  children,
  showPending = true,
  markActive = true,
  prefetch = true,
}: {
  href: string
  className?: string
  children: React.ReactNode
  showPending?: boolean
  /** False for the logo/title block — never paint chrome underlines there. */
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
      {showPending ? <NavLinkPending /> : null}
    </Link>
  )
}

/** Spinning nanowheel while this link’s navigation is in flight. */
function NavLinkPending() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <Nanowheel size="xs" spin className="opacity-90" />
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
