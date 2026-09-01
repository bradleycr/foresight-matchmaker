import type { Kind } from "@rmm/schema"
import { pairNameClass, tileNameClass } from "@/lib/onsite/name-fit"
import type { OnsiteFeed } from "@/lib/onsite/types"

type Card = OnsiteFeed["people"][number]
type Tone = "hero" | "pair" | "tile"

/**
 * Kind is carried twice — a solid left rail and a wash behind the name — so
 * the three groups separate at projector distance without a legend hunt.
 */
const kindSkin: Record<Kind, string> = {
  data_holder: "border-l-teal bg-tint-teal",
  ai_team: "border-l-mark bg-tint-mark",
  consortium: "border-l-ink bg-tint-ink",
  individual: "border-l-ink bg-tint-ink",
}

/**
 * Name-first card. Tiles are wash + name only so a full room still fits one
 * landscape frame; pair cards add the one thing that party is looking for.
 */
export function LiveFeedPersonCard({
  org_name,
  kind_label,
  one_liner,
  looking_for,
  kind,
  tone,
}: Card & { tone: Tone }) {
  const chip = tone === "pair" ? looking_for[0] : undefined
  // Only the two featured cards carry prose — it is what makes the pairing
  // legible. Wall tiles stay name-only so the room reads at a glance.
  const blurb = tone === "tile" ? undefined : one_liner
  const nameSize =
    tone === "hero" ? "text-5xl" : tone === "pair" ? pairNameClass(org_name) : tileNameClass(org_name)

  return (
    <article
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-2 border-ink ${kindSkin[kind]} ${
        tone === "tile" ? "border-l-4 px-2.5 py-2" : "border-l-8 px-4 py-3"
      }`}
    >
      <p className="shrink-0 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-deep">
        {kind_label}
      </p>
      {/* The name never absorbs the squeeze — a half-cut org name is worse
        * than a shorter blurb, so only the prose below is allowed to give.
        * Wall tiles centre it, which turns each cell into a nameplate. */}
      <div className={tone === "tile" ? "flex min-h-0 flex-1 items-center" : "contents"}>
        <h3
          className={`mt-1 shrink-0 hyphens-auto break-words font-listing uppercase leading-[1.06] tracking-tight ${nameSize} ${
            tone === "tile" ? "line-clamp-4" : tone === "pair" ? "line-clamp-3" : ""
          }`}
        >
          {org_name}
        </h3>
      </div>
      {blurb ? (
        <p
          className={`mt-3 min-h-0 overflow-hidden leading-snug text-ink-soft ${
            tone === "hero" ? "line-clamp-3 text-lg" : "line-clamp-3 text-sm"
          }`}
        >
          {blurb}
        </p>
      ) : null}
      {chip ? (
        <p className="mt-auto shrink-0 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{chip}</p>
      ) : null}
    </article>
  )
}
