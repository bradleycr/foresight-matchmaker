"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * On every client navigation, ask the server to slide the httpOnly session
 * forward. At events people scan QR codes repeatedly — each page view
 * should refresh the cookie so they never hit an expiry mid-session.
 */
export function SessionRenew() {
  const pathname = usePathname()

  useEffect(() => {
    void fetch("/api/v1/auth/touch", { cache: "no-store" })
  }, [pathname])

  return null
}
