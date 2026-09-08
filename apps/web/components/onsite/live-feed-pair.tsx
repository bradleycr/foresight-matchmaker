import type { ReactNode } from "react"
import { LiveFeedPersonCard } from "@/components/onsite/live-feed-person-card"
import type { OnsiteFeed } from "@/lib/onsite/types"

/** Two complementary orgs. `compact` is the first-arrivals size — not a wall-high stack. */
export function LiveFeedPair({
  left,
  right,
  title,
  countdown,
  lookingForLabel,
  profileOrigin,
  profileQrLabel,
  compact = false,
}: {
  left: OnsiteFeed["people"][number]
  right: OnsiteFeed["people"][number]
  title: string
  countdown?: ReactNode
  lookingForLabel: string
  profileOrigin: string
  profileQrLabel: string
  compact?: boolean
}) {
  const card = (person: OnsiteFeed["people"][number]) => (
    <LiveFeedPersonCard
      {...person}
      tone="pair"
      lookingForLabel={lookingForLabel}
      profileOrigin={profileOrigin}
      profileQrLabel={profileQrLabel}
    />
  )

  const plus = (
    <div
      className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-mark px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-mark-ink shadow-[0_0_0_2px_var(--color-paper)]"
      aria-hidden="true"
    >
      +
    </div>
  )

  if (compact) {
    return (
      <section aria-label={title} className="flex w-full max-w-[38.5rem] flex-col items-center">
        <p className="text-center font-listing text-[clamp(1.75rem,3.2vw,2.75rem)] uppercase leading-[0.92] tracking-tight">
          {title}
        </p>
        {countdown}
        <div className="relative mt-4 grid w-full grid-cols-2 gap-3">
          <div className="h-[12.5rem] min-h-0">{card(left)}</div>
          {plus}
          <div className="h-[12.5rem] min-h-0">{card(right)}</div>
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label={title}
      className="flex h-full w-[min(28rem,30vw)] shrink-0 flex-col pr-4 sm:pr-5"
    >
      <p className="font-listing text-[clamp(2rem,4.2vw,3rem)] uppercase leading-[0.92] tracking-tight">{title}</p>
      {countdown}
      <div className="relative mt-5 grid min-h-0 flex-1 grid-rows-2 gap-5">
        <div className="min-h-0">{card(left)}</div>
        {plus}
        <div className="min-h-0">{card(right)}</div>
      </div>
    </section>
  )
}
