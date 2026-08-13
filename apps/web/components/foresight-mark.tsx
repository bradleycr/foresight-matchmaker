/**
 * Official Foresight wordmark — intrinsic ratio, never stretched.
 * Height is set on the wrapper; the image fills it with object-contain.
 */
export function ForesightMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 self-start ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/partners/foresight.png"
        alt="Foresight Institute"
        width={513}
        height={192}
        className="h-full w-auto max-w-none object-contain object-left"
      />
    </span>
  )
}
