"use client"

import { useLayoutEffect, useRef } from "react"

/**
 * Shrinks display type until the full name fits its cell — no ellipsis.
 * ResizeObserver keeps kiosk tiles honest when the grid reflows.
 */
export function FittedName({
  name,
  minPx = 7,
  maxPx = 16,
  className = "",
}: {
  name: string
  minPx?: number
  maxPx?: number
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const text = textRef.current
    if (!box || !text) return

    function fit() {
      let size = maxPx
      text!.style.fontSize = `${size}px`
      // Walk down in quarter-pixel steps until the whole name fits.
      while (size > minPx && (text!.scrollHeight > box!.clientHeight + 0.5 || text!.scrollWidth > box!.clientWidth + 0.5)) {
        size -= 0.25
        text!.style.fontSize = `${size}px`
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [name, minPx, maxPx])

  return (
    <div ref={boxRef} className="h-full min-h-0 overflow-hidden">
      <h3
        ref={textRef}
        className={`break-words font-listing uppercase leading-[1.05] tracking-tight hyphens-auto text-pretty [overflow-wrap:anywhere] ${className}`}
      >
        {name}
      </h3>
    </div>
  )
}
