import type { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { ChallengeDef } from "@/lib/challenges/catalog"

/**
 * Marks a programme that is built but not launched.
 *
 * A preview is only ever rendered to someone the visibility rules already
 * let in, so this is not a lock — it is the courtesy of telling a demo
 * audience that what they are looking at is not public yet.
 */

/** Inline flag beside a programme's name in a list. */
export function ProgrammeStatusTag({
  challenge,
  t,
  className,
}: {
  challenge: ChallengeDef
  t: T
  className?: string
}) {
  if (challenge.status !== "preview") return null

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border border-dashed border-ink px-1.5 py-px align-middle",
        "font-sans text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-ink-soft",
        className,
      )}
    >
      {t("challenge.preview_tag")}
    </span>
  )
}

/** Full-width explanation at the top of a preview programme's own pages. */
export function ProgrammePreviewNotice({
  challenge,
  t,
  className,
}: {
  challenge: ChallengeDef
  t: T
  className?: string
}) {
  if (challenge.status !== "preview") return null

  return (
    <aside
      role="note"
      className={cn("border border-dashed border-ink bg-paper-shade px-4 py-3", className)}
    >
      <p className="font-listing text-sm font-bold uppercase tracking-widest">
        {t("challenge.preview_tag")}
      </p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
        {t("challenge.preview_note")}
      </p>
    </aside>
  )
}
