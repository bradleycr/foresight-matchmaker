/**
 * Foresight publisher plate — official wordmark locked into directory yellow
 * with a teal spine. Reads as an imprint, not a favicon dump. Parent `.group`
 * hover flips the plate to ink so the mark becomes a white press stamp.
 */
export function ForesightMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center border-l-[5px] border-teal bg-mark px-3 py-2.5 transition-colors duration-150 group-hover:bg-ink ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/partners/foresight.png"
        alt="Foresight Institute"
        width={140}
        height={52}
        className="h-7 w-auto sm:h-8 transition-[filter] duration-150 group-hover:invert"
      />
    </span>
  )
}
