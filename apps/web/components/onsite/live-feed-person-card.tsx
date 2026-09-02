import { FittedName } from "@/components/onsite/fitted-name"
import { KIND_SKIN } from "@/lib/onsite/kind-skin"
import { pairNameMaxPx, tileNameMaxPx } from "@/lib/onsite/name-fit"
import type { OnsiteFeed } from "@/lib/onsite/types"

type Card = OnsiteFeed["people"][number]
type Tone = "hero" | "pair" | "tile"

function formatLookingFor(labels: readonly string[], heading: string, max: number): string | undefined {
  if (labels.length === 0) return undefined
  const items = labels.slice(0, max).join(" · ")
  const more = labels.length > max ? " …" : ""
  return `${heading}: ${items}${more}`
}

/**
 * Name-first card. Wall tiles auto-fit the full org name; the footer is a
 * fixed band so names and “looking for” never compete for the same pixels.
 */
export function LiveFeedPersonCard({
  org_name,
  kind_label,
  one_liner,
  looking_for,
  kind,
  tone,
  lookingForLabel,
}: Card & { tone: Tone; lookingForLabel?: string }) {
  const showSeeking = Boolean(lookingForLabel) && looking_for.length > 0
  const seekingMax = tone === "tile" ? 1 : looking_for.length
  const seekingLine = showSeeking ? formatLookingFor(looking_for, lookingForLabel!, seekingMax) : undefined
  const blurb = tone === "tile" ? undefined : one_liner

  if (tone === "tile") {
    return (
      <article
        className={`box-border grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden border-2 border-ink ${KIND_SKIN[kind]} border-l-4 px-3 py-2`}
      >
        <p className="shrink-0 text-[9px] font-semibold uppercase leading-tight tracking-[0.12em] text-teal-deep">
          {kind_label}
        </p>
        <FittedName
          name={org_name}
          maxPx={tileNameMaxPx(org_name, { withFooter: showSeeking })}
          minPx={6.5}
        />
        {seekingLine ? (
          <p className="mt-1 shrink-0 break-words text-[8px] font-semibold uppercase leading-[1.2] tracking-wide text-ink-soft [overflow-wrap:anywhere]">
            {seekingLine}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
      </article>
    )
  }

  return (
    <article
      className={`box-border grid h-full min-h-0 min-w-0 overflow-hidden border-2 border-ink ${KIND_SKIN[kind]} border-l-8 px-5 py-4 ${
        tone === "pair" ? "grid-rows-[auto_minmax(0,1fr)_auto_auto]" : "grid-rows-[auto_auto_auto]"
      }`}
    >
      <p className="shrink-0 text-[10px] font-semibold uppercase leading-tight tracking-[0.14em] text-teal-deep">
        {kind_label}
      </p>
      {tone === "hero" ? (
        <h3 className="mt-1 break-words font-listing text-5xl uppercase leading-[1.06] tracking-tight hyphens-auto text-pretty [overflow-wrap:anywhere]">
          {org_name}
        </h3>
      ) : (
        <FittedName name={org_name} maxPx={pairNameMaxPx(org_name)} minPx={14} />
      )}
      {blurb ? (
        <p className="mt-2 min-h-0 shrink-0 break-words leading-snug text-ink-soft [overflow-wrap:anywhere] line-clamp-2 text-sm">
          {blurb}
        </p>
      ) : (
        <span aria-hidden="true" />
      )}
      {seekingLine ? (
        <p className="mt-2 shrink-0 break-words text-[11px] font-semibold uppercase leading-snug tracking-wide text-ink-soft [overflow-wrap:anywhere]">
          {seekingLine}
        </p>
      ) : null}
    </article>
  )
}
