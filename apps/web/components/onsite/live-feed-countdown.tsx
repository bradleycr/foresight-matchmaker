"use client"

import { useEffect, useRef, useState } from "react"
import { msUntilNextSpotlight } from "@/lib/onsite/rotation"

/**
 * Seconds until the next pair takes the spotlight.
 *
 * Two details matter. It renders nothing until mounted, because a clock in the
 * server HTML can only ever disagree with the client's. And it samples faster
 * than it displays, so the moment the countdown wraps we can tell the board to
 * refetch — otherwise the number hits zero and the pair sits there until the
 * next poll, which reads as a broken screen.
 */
export function LiveFeedCountdown({
  label,
  onRotate,
}: {
  label: (seconds: number) => string
  onRotate: () => void
}) {
  const [seconds, setSeconds] = useState<number | null>(null)
  const rotate = useRef(onRotate)
  rotate.current = onRotate

  useEffect(() => {
    let previous = Number.POSITIVE_INFINITY

    function sample() {
      const next = Math.ceil(msUntilNextSpotlight() / 1000)
      if (next > previous) rotate.current()
      previous = next
      // React bails out on an unchanged value, so the board repaints once a
      // second even though we look four times as often.
      setSeconds(next)
    }

    sample()
    const id = window.setInterval(sample, 250)
    return () => window.clearInterval(id)
  }, [])

  if (seconds === null) return null

  return (
    <p className="tnum mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint" aria-hidden="true">
      {label(seconds)}
    </p>
  )
}
