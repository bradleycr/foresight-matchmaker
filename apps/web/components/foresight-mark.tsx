/**
 * Official Foresight wordmark — clean on paper, no plate behind it.
 */
export function ForesightMark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/partners/foresight.png"
      alt="Foresight Institute"
      width={140}
      height={52}
      className={`h-8 w-auto opacity-90 transition-opacity duration-150 group-hover:opacity-100 sm:h-9 ${className}`}
    />
  )
}
