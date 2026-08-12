"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Tag } from "@/components/ui/primitives"
import type { GuideMatchCard } from "@/lib/remmy/hydrate-guide"
import { IntroComposePart } from "./intro-compose-part"

/**
 * Match detail + intro compose. Bottom sheet on small screens, centred
 * panel on desktop — never nested inside the chat scroller.
 */
export function MatchSheet({
  match,
  intro,
  onClose,
}: {
  match?: GuideMatchCard
  intro?: { toId: string; toName: string; toSlug: string; draftMessage: string }
  onClose: () => void
}) {
  const t = useT()
  const name = match?.profile.org_name ?? intro?.toName ?? ""
  const slug = match?.profile.slug ?? intro?.toSlug ?? ""
  const toId = match?.profile.id ?? intro?.toId ?? ""
  const draft = intro?.draftMessage ?? t("guide.default_intro", { name })

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    if (intro) {
      document.getElementById("match-sheet-intro")?.scrollIntoView({ block: "nearest" })
    }
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose, intro])

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="match-sheet-title">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label={t("guide.close")}
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(92dvh,40rem)] flex-col border-t-2 border-ink bg-paper sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border-2">
        <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
          <div className="min-w-0">
            {match ? (
              <div className="flex items-start gap-3">
                <span className="tnum w-12 shrink-0 border-r-4 border-mark pr-2 text-right font-listing text-3xl font-bold">
                  {match.score}
                </span>
                <div className="min-w-0">
                  <h2 id="match-sheet-title" className="font-listing text-lg font-bold uppercase leading-tight">
                    {name}
                  </h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                    <span>{match.profile.country}</span>
                    <Tag>{enumLabel(t, "kind", match.profile.kind)}</Tag>
                  </p>
                </div>
              </div>
            ) : (
              <h2 id="match-sheet-title" className="font-listing text-lg font-bold uppercase leading-tight">
                {t("guide.intro_title", { name })}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-ink px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
          >
            {t("guide.close")}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {match ? (
            <>
              <p className="text-sm text-ink-soft">{match.profile.one_liner}</p>
              <p className="mt-3 text-sm leading-relaxed">{match.rationale}</p>
              {match.blockers.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {match.blockers.map((b) => (
                    <li key={b.key} className="border-l-2 border-alert pl-2 text-sm">
                      <strong className="uppercase">{t(`blocker_severity.${b.severity}`)}: </strong>
                      {b.note}
                    </li>
                  ))}
                </ul>
              ) : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide hover:underline">
                  {t("matches.breakdown")}
                </summary>
                <table className="tnum mt-2 w-full text-sm">
                  <tbody>
                    {match.factors.map((factor) => (
                      <tr key={factor.key} className="border-b border-rule">
                        <td className="py-1.5 pr-2">{t(`factor.${factor.key}`)}</td>
                        <td className="py-1.5 text-right">
                          {Math.round(factor.earned)}/{factor.weight}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <Link
                href={`/profile/${slug}`}
                className="mt-4 inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
              >
                {t("guide.view_profile")}
              </Link>
            </>
          ) : null}

          {(!match || match.profile.open_to_intros) && toId ? (
            <div id="match-sheet-intro" className={match ? "mt-6 border-t-2 border-rule-strong pt-4" : undefined}>
              <IntroComposePart
                toId={toId}
                toName={name}
                toSlug={slug}
                draftMessage={draft}
                embedded
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
