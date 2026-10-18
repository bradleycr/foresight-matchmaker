import type { T } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { ChallengeDef } from "@/lib/challenges/catalog"

/**
 * Status chip / notice for a programme card or programme page.
 * Preview = not public yet. Closed = archive, no new listings.
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
  if (challenge.status === "open") return null

  const label =
    challenge.status === "closed" ? t("challenge.closed_tag") : t("challenge.preview_tag")

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center border px-1.5 py-px align-middle",
        "font-sans text-[10px] font-semibold uppercase leading-none tracking-[0.16em]",
        challenge.status === "closed"
          ? "border-rule-strong text-ink-soft"
          : "border-dashed border-ink text-ink-soft",
        className,
      )}
    >
      {label}
    </span>
  )
}

/** Full-width explanation at the top of a preview or closed programme page. */
export function ProgrammePreviewNotice({
  challenge,
  t,
  className,
}: {
  challenge: ChallengeDef
  t: T
  className?: string
}) {
  if (challenge.status === "open") return null

  const tag =
    challenge.status === "closed" ? t("challenge.closed_tag") : t("challenge.preview_tag")
  const note =
    challenge.status === "closed"
      ? t(`challenge.${challenge.id}.closed_note`)
      : t("challenge.preview_note")

  return (
    <aside
      role="note"
      className={cn("border border-dashed border-ink bg-paper-shade px-4 py-3", className)}
    >
      <p className="font-listing text-sm font-bold uppercase tracking-widest">{tag}</p>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{note}</p>
    </aside>
  )
}
