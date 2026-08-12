"use client"

import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Tag } from "@/components/ui/primitives"
import type { GuideMatchCard } from "@/lib/remmy/hydrate-guide"

/**
 * Generative UI: up to five match cards inside the Remmy guide thread.
 * Scores and blockers come from the scorer — never from model prose.
 */
export function MatchShortlistPart({
  matches,
  onConnect,
}: {
  matches: GuideMatchCard[]
  onConnect?: (match: GuideMatchCard) => void
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
    <ol className="border border-ink">
      {matches.map((match) => (
        <li key={match.profile.id} className="border-b border-rule px-3 py-3 last:border-b-0">
          <div className="flex items-start gap-3">
            <span className="tnum w-10 shrink-0 border-r-4 border-mark pr-2 text-right font-listing text-2xl font-bold">
              {match.score}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  href={`/profile/${match.profile.slug}`}
                  className="font-listing text-base font-bold uppercase leading-tight hover:underline"
                >
                  {match.profile.org_name}
                </Link>
                <span className="text-xs text-ink-soft">{match.profile.country}</span>
                <Tag>{enumLabel(t, "kind", match.profile.kind)}</Tag>
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">{match.profile.one_liner}</p>
              <p className="mt-1 text-sm">{match.rationale}</p>
              {match.blockers.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {match.blockers.slice(0, 3).map((b) => (
                    <li key={b.key} className="border-l-2 border-alert pl-2 text-xs">
                      <strong className="uppercase">{t(`blocker_severity.${b.severity}`)}: </strong>
                      {b.note}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/profile/${match.profile.slug}`}
                  className="border border-ink px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
                >
                  {t("guide.view_profile")}
                </Link>
                {match.profile.open_to_intros && onConnect ? (
                  <button
                    type="button"
                    onClick={() => onConnect(match)}
                    className="border border-ink bg-mark px-2 py-1 text-xs font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
                  >
                    {t("guide.connect")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function MatchDetailPart({
  match,
  onConnect,
}: {
  match: GuideMatchCard
  onConnect?: (match: GuideMatchCard) => void
}) {
  const t = useT()
  return (
    <div className="border border-ink p-3">
      <div className="flex items-start gap-3">
        <span className="tnum w-12 shrink-0 border-r-4 border-mark pr-2 text-right font-listing text-3xl font-bold">
          {match.score}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/profile/${match.profile.slug}`}
            className="font-listing text-lg font-bold uppercase hover:underline"
          >
            {match.profile.org_name}
          </Link>
          <p className="mt-1 text-sm">{match.rationale}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide hover:underline">
              {t("matches.breakdown")}
            </summary>
            <table className="tnum mt-2 w-full text-xs">
              <tbody>
                {match.factors.map((factor) => (
                  <tr key={factor.key} className="border-b border-rule">
                    <td className="py-1 pr-2">{t(`factor.${factor.key}`)}</td>
                    <td className="py-1 text-right">
                      {Math.round(factor.earned)}/{factor.weight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {onConnect && match.profile.open_to_intros ? (
            <button
              type="button"
              onClick={() => onConnect(match)}
              className="mt-3 border border-ink bg-mark px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
            >
              {t("guide.connect")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
