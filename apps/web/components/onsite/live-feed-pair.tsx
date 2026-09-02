import type { ReactNode } from "react"
import { LiveFeedPersonCard } from "@/components/onsite/live-feed-person-card"
import type { OnsiteFeed } from "@/lib/onsite/types"

/** Two complementary orgs, stacked in the focal left column. */
export function LiveFeedPair({
  left,
  right,
  title,
  countdown,
  lookingForLabel,
}: {
  left: OnsiteFeed["people"][number]
  right: OnsiteFeed["people"][number]
  title: string
  countdown?: ReactNode
  lookingForLabel: string
}) {
  return (
    <section
      aria-label={title}
      className="flex h-full w-[min(32rem,34vw)] shrink-0 flex-col pr-6"
    >
      <p className="font-listing text-[3.25rem] uppercase leading-[0.92] tracking-tight">{title}</p>
      {countdown}
      <div className="relative mt-5 grid min-h-0 flex-1 grid-rows-2 gap-5">
        <div className="min-h-0">
          <LiveFeedPersonCard {...left} tone="pair" lookingForLabel={lookingForLabel} />
        </div>
        <div
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-mark px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-mark-ink shadow-[0_0_0_2px_var(--color-paper)]"
          aria-hidden="true"
        >
          +
        </div>
        <div className="min-h-0">
          <LiveFeedPersonCard {...right} tone="pair" lookingForLabel={lookingForLabel} />
        </div>
      </div>
    </section>
  )
}
