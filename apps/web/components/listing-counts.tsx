import type { DirectoryStatsPayload } from "@/lib/api/types"
import type { T } from "@/lib/i18n"

type KindCounts = DirectoryStatsPayload["by_challenge"][string]

const KIND_ROWS = [
  ["data_holder", "landing.count_data_holders"],
  ["ai_team", "landing.count_ai_teams"],
  ["consortium", "landing.count_consortia"],
  ["individual", "landing.count_individuals"],
] as const

export function kindCountTotal(counts: KindCounts | undefined | null): number {
  if (!counts) return 0
  return KIND_ROWS.reduce((n, [kind]) => n + (counts[kind] ?? 0), 0)
}

/**
 * Programme listing totals. Hidden when the directory is empty so four
 * zeroes are never mistaken for a broken page.
 */
export function ListingCounts({
  counts,
  t,
  captionKey = "landing.counts_caption",
}: {
  counts: KindCounts
  t: T
  captionKey?: string
}) {
  if (kindCountTotal(counts) === 0) {
    return <p className="text-sm text-ink-soft">{t("landing.counts_empty")}</p>
  }

  return (
    <div>
      <dl className="grid grid-cols-1 gap-px border border-rule-strong bg-rule-strong sm:grid-cols-2 lg:grid-cols-4">
        {KIND_ROWS.map(([kind, key]) => (
          <div key={kind} className="bg-paper px-4 py-5">
            <dd className="tnum font-listing text-5xl font-bold">{counts[kind]}</dd>
            <dt className="mt-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">{t(key)}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{t(captionKey)}</p>
    </div>
  )
}
