"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { cn } from "@/lib/utils"

/**
 * Header/footer Link that lights a mark the moment the click is in flight.
 * `useLinkStatus` is the App Router API for this — it is pending on the
 * clicked link, not a guessed global spinner.
 */
export function NavLink({
  href,
  className,
  children,
  showPending = true,
}: {
  href: string
  className?: string
  children: React.ReactNode
  showPending?: boolean
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      {showPending ? <NavLinkPending /> : null}
    </Link>
  )
}

function NavLinkPending() {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-1.5 shrink-0 bg-mark", pending ? "opacity-100" : "opacity-0")}
    />
  )
}
