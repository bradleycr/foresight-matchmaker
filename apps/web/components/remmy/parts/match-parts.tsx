"use client"

import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Tag } from "@/components/ui/primitives"
import type { GuideMatchCard } from "@/lib/remmy/hydrate-guide"

/**
 * Compact ranked rows for the Remmy thread. Detail and intro live in
 * MatchSheet — this list must stay scannable on a phone.
 */
export function MatchShortlistPart({
  matches,
  onOpen,
}: {
  matches: GuideMatchCard[]
  onOpen?: (match: GuideMatchCard, intent: "detail" | "intro") => void
}) {
  const t = useT()

  if (matches.length === 0) {
    return (
      <div className="border border-ink bg-paper-shade px-3 py-3 text-sm">
        <p className="font-semibold">{t("matches.empty_title")}</p>
        <p className="mt-1 text-ink-soft">{t("guide.shortlist_empty")}</p>
      </div>
    )
  }

  return (
    <div className="border border-ink">
      <p className="border-b border-rule bg-paper-shade px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {t("guide.shortlist_caption", { count: matches.length })}
      </p>
      <ol>
        {matches.map((match) => (
          <li key={match.profile.id} className="border-b border-rule last:border-b-0">
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => onOpen?.(match, "detail")}
                className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left hover:bg-paper-shade"
              >
                <span className="tnum w-10 shrink-0 border-r-4 border-mark pr-2 text-right font-listing text-2xl font-bold leading-none">
                  {match.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-listing text-base font-bold uppercase leading-tight">
                      {match.profile.org_name}
                    </span>
                    <span className="text-xs text-ink-soft">{match.profile.country}</span>
                    <Tag>{enumLabel(t, "kind", match.profile.kind)}</Tag>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-ink-soft">{match.profile.one_liner}</span>
                  {match.blockers.length > 0 ? (
                    <span className="mt-1 block text-xs uppercase tracking-wide text-alert">
                      {t("guide.has_caution")}
                    </span>
                  ) : null}
                </span>
              </button>
              {match.profile.open_to_intros && onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(match, "intro")}
                  className="min-h-11 shrink-0 self-stretch border-l border-ink bg-mark px-3 text-xs font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper sm:px-4"
                >
                  {t("contact.email_button")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function MatchDetailChip({
  match,
  onOpen,
}: {
  match: GuideMatchCard
  onOpen?: (match: GuideMatchCard, intent: "detail" | "intro") => void
}) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={() => onOpen?.(match, "detail")}
      className="flex w-full items-start gap-3 border border-ink px-3 py-3 text-left hover:bg-paper-shade"
    >
      <span className="tnum w-10 shrink-0 border-r-4 border-mark pr-2 text-right font-listing text-2xl font-bold leading-none">
        {match.score}
      </span>
      <span className="min-w-0">
        <span className="font-listing text-base font-bold uppercase leading-tight">{match.profile.org_name}</span>
        <span className="mt-0.5 block text-sm text-ink-soft">{t("guide.open_sheet")}</span>
      </span>
    </button>
  )
}

export function IntroDraftChip({
  name,
  onOpen,
}: {
  name: string
  onOpen: () => void
}) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full border border-ink bg-paper-shade px-3 py-3 text-left hover:bg-mark"
    >
      <span className="block font-listing text-sm font-bold uppercase">{t("contact.title")}</span>
      <span className="mt-0.5 block text-sm text-ink-soft">{t("contact.open_sheet", { name })}</span>
    </button>
  )
}
