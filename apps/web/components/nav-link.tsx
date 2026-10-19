"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { Nanowheel } from "@/components/nanowheel"
import { cn } from "@/lib/utils"

/**
 * Header/footer Link that lights a mark the moment the click is in flight.
 * `useLinkStatus` is the App Router API for this — it is pending on the
 * clicked link, not a guessed global spinner.
 *
 * Active route gets a still nanowheel; pending gets the spin. Same mark
 * Atlas uses for profile chips — one Foresight language across products.
 *
 * `prefetch` is explicitly `true` rather than the default `auto`. Every
 * destination here is `force-dynamic`, and `auto` only prefetches such a
 * route as far as its `loading.tsx` — which is why a header tap used to
 * paint the skeleton and then sit there waiting for the real render. The
 * handful of nav targets is a small enough set to warm in full.
 */
export function NavLink({
  href,
  className,
  children,
  showPending = true,
  prefetch = true,
}: {
  href: string
  className?: string
  children: React.ReactNode
  showPending?: boolean
  prefetch?: boolean
}) {
  const pathname = usePathname()
  const active = isActiveHref(pathname, href)

  return (
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5",
        active && "underline decoration-mark decoration-2 underline-offset-4",
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
  return (
    <Nanowheel
      size="xs"
      spin={pending}
      className={cn("transition-opacity duration-150", pending ? "opacity-90" : "opacity-0")}
    />
  )
}

/** Match path (and hash-free directory desks) without lighting every `#` sibling. */
function isActiveHref(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  const path = href.split("?")[0]?.split("#")[0] ?? href
  if (!path || path === "/") return pathname === "/"
  if (path.startsWith("/#")) return false
  return pathname === path || pathname.startsWith(`${path}/`)
}
