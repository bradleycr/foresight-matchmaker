"use client"

import { Suspense, useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Thin top bar that starts on the click, not when the next page arrives.
 * App Router can sit still for seconds on a dynamic route; this is the
 * acknowledgement that the navigation was registered.
 */
export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <NavProgressBar />
    </Suspense>
  )
}

function NavProgressBar() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(false)
  }, [pathname, search])

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const a = (event.target as Element | null)?.closest?.("a")
      if (!a) return
      if (a.target && a.target !== "_self") return
      if (a.hasAttribute("download")) return
      const href = a.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      let url: URL
      try {
        url = new URL(a.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setActive(true)
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  useEffect(() => {
    document.documentElement.toggleAttribute("data-nav-pending", active)
    return () => document.documentElement.removeAttribute("data-nav-pending")
  }, [active])

  if (!active) return null

  return (
    <div
      role="progressbar"
      aria-hidden="true"
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <div className="nav-progress-bar h-full w-full" />
    </div>
  )
}
