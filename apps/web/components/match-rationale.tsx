"use client"

import { useEffect, useState } from "react"

/**
 * Shows the deterministic template immediately, then optionally upgrades to
 * LLM prose after paint. Ranking stays untouched; a failed upgrade leaves
 * the template in place.
 */
export function MatchRationale({
  otherId,
  initial,
  polish,
}: {
  otherId: string
  initial: string
  polish: boolean
}) {
  const [text, setText] = useState(initial)

  useEffect(() => {
    setText(initial)
    if (!polish) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/v1/matches/rationale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ other_id: otherId }),
        })
        if (!res.ok || cancelled) return
        const body = (await res.json()) as { rationale?: string }
        if (body.rationale && !cancelled) setText(body.rationale)
      } catch {
        // Template stays — LLM is optional polish only.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [otherId, initial, polish])

  if (!text) return null
  return <p className="mt-1 text-sm">{text}</p>
}
