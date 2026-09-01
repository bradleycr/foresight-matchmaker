"use client"

import { useEffect, useRef } from "react"

/**
 * Once per tab, ask the server to slide the httpOnly session forward.
 * Returning visitors stay signed in without another magic link.
 */
export function SessionRenew() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    void fetch("/api/v1/auth/touch", { cache: "no-store" })
  }, [])

  return null
}
