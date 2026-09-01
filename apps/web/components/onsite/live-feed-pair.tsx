import type { ReactNode } from "react"
import { LiveFeedPersonCard } from "@/components/onsite/live-feed-person-card"
import type { OnsiteFeed } from "@/lib/onsite/types"

/** Two complementary orgs, stacked, with a gold mark that reads as “pair these”. */
export function LiveFeedPair({
  left,
  right,
  title,
  countdown,
}: {
  left: OnsiteFeed["people"][number]
  right: OnsiteFeed["people"][number]
  title: string
  countdown?: ReactNode
}) {
  return (
    <section aria-label={title} className="flex h-full w-72 shrink-0 flex-col">
      <p className="font-listing text-[2rem] uppercase leading-none tracking-tight">{title}</p>
      {countdown}
      <div className="relative mt-4 grid min-h-0 flex-1 grid-rows-2 gap-4">
        <div className="min-h-0">
          <LiveFeedPersonCard {...left} tone="pair" />
        </div>
        <div
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 border-2 border-ink bg-mark px-3 py-1 text-xs font-semibold uppercase tracking-widest text-mark-ink"
          aria-hidden="true"
        >
          +
        </div>
        <div className="min-h-0">
          <LiveFeedPersonCard {...right} tone="pair" />
        </div>
      </div>
    </section>
  )
}
