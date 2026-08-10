import Link from "next/link"
import { redirect } from "next/navigation"
import type { Profile } from "@rmm/schema"
import { apiFetch, redirectOnAuthFailure } from "@/lib/api/server-fetch"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import { enumLabel } from "@/lib/i18n/labels"
import { llmEnabled } from "@/lib/llm/client"
import type { MatchPayload } from "@/lib/api/types"
import { Tag } from "@/components/ui/primitives"
import { MatchRationale } from "@/components/match-rationale"
import type { T } from "@/lib/i18n"

export const dynamic = "force-dynamic"

/**
 * The ranked shortlist. Every entry shows its score as a plain numeral, its
 * full factor breakdown, and its blockers — soft blockers are displayed,
 * never hidden. That friction is the product.
 */

/** The single field most likely to unlock matches — the empty state names it. */
function nudgeField(profile: Profile): string {
  if (profile.parallel_public_funding === "yes") return "parallel_public_funding"
  if (profile.application_status === "not_applying" || profile.application_status === "team_complete")
    return "application_status"
  if (!profile.open_to_intros) return "open_to_intros"
  if (profile.kind !== "data_holder") {
    if (profile.privacy_capability.length === 0) return "privacy_capability"
    if (profile.data_needs.modality.length === 0) return "data_needs"
  }
  if (profile.kind !== "ai_team" && profile.datasets.some((d) => d.access_model === "undecided")) {
    return "access_model"
  }
  if (profile.languages.length === 0) return "languages"
  return "attending"
}

/** Localised template prose — the mandatory path when no LLM is configured. */
function localisedTemplate(match: MatchPayload, t: T): string {
  if (match.factors.length < 2) return match.rationale

  const scored = match.factors
    .filter((f) => f.weight > 0)
    .map((f) => ({ ...f, ratio: f.earned / f.weight }))
    .sort((a, b) => b.ratio - a.ratio)
  if (scored.length < 2) return match.rationale

  const best = scored[0]!
  const second = scored[1]!
  const worst = scored[scored.length - 1]!

  const strong = t("matches.rationale_strong", {
    a: t(`factor.${best.key}`).toLowerCase(),
    b: t(`factor.${second.key}`).toLowerCase(),
  })
  if (worst.ratio >= 0.9) return `${strong} ${t("matches.rationale_no_gap")}`

  return `${strong} ${t("matches.rationale_gap", {
    c: t(`factor.${worst.key}`).toLowerCase(),
    earned: Math.round(worst.earned),
    weight: worst.weight,
  })}`
}

function FactorBreakdown({ match, t }: { match: MatchPayload; t: T }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide hover:underline">
        {t("matches.breakdown")}
      </summary>
      <table className="tnum mt-2 w-full max-w-md text-sm">
        <caption className="sr-only">{t("matches.breakdown")}</caption>
        <tbody>
          {match.factors.map((factor) => (
            <tr key={factor.key} className="border-b border-rule">
              <td className="py-1 pr-2">{t(`factor.${factor.key}`)}</td>
              <td className="py-1 pr-2 text-right">
                {Math.round(factor.earned)}/{factor.weight}
              </td>
              <td className="py-1 text-ink-soft">{factor.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export default async function MatchesPage() {
  const session = await getSession()
  if (!session) redirect("/signin")

  const { t } = await getT()
  const polish = llmEnabled()

  const [matchRes, profileRes] = await Promise.all([
    apiFetch("/api/v1/matches"),
    apiFetch(`/api/v1/profiles/${session.profileId}`),
  ])
  redirectOnAuthFailure(matchRes)
  redirectOnAuthFailure(profileRes)
  if (!matchRes.ok) throw new Error(`Could not load matches (status ${matchRes.status}).`)
  if (!profileRes.ok) throw new Error(`Could not load your profile (status ${profileRes.status}).`)

  const { matches } = (await matchRes.json()) as { matches: MatchPayload[] }
  const { profile } = (await profileRes.json()) as { profile: Profile }

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("matches.title")}</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">{t("matches.explainer")}</p>

      {matches.length === 0 ? (
        // Not an apology: it names the one field to fill in next.
        <div className="mt-8 max-w-xl border border-ink p-4">
          <p className="font-semibold">{t("matches.empty_title")}</p>
          <p className="mt-1">{t(`matches.empty_nudge.${nudgeField(profile)}`)}</p>
          <Link href="/me" className="mt-3 inline-block font-semibold underline">
            {t("matches.empty_cta")}
          </Link>
        </div>
      ) : (
        <ol className="mt-6">
          {matches.map((match) => (
            <li key={match.profile.id} className="border-b border-rule py-4">
              <div className="flex items-start gap-4">
                {/* The score: a numeral in the row, not a pill. */}
                <span aria-label={t("matches.score_label", { score: match.score })} className="tnum w-14 shrink-0 border-r-4 border-mark pr-3 text-right font-listing text-3xl font-bold">
                  {match.score}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/profile/${match.profile.slug}`} className="font-listing text-lg font-bold uppercase leading-tight hover:underline">
                      {match.profile.org_name}
                    </Link>
                    <span className="text-sm text-ink-soft">{match.profile.country}</span>
                    <Tag>{enumLabel(t, "kind", match.profile.kind)}</Tag>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-soft">{match.profile.one_liner}</p>
                  <MatchRationale
                    otherId={match.profile.id}
                    initial={localisedTemplate(match, t)}
                    polish={polish}
                  />

                  {match.blockers.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {match.blockers.map((blocker) => (
                        <li key={blocker.key} className="border-l-2 border-alert pl-2 text-sm">
                          <strong className="uppercase">{t(`blocker_severity.${blocker.severity}`)}: </strong>
                          {blocker.note}
                        </li>
                      ))}
                    </ul>
                  )}

                  <FactorBreakdown match={match} t={t} />

                  <Link href={`/profile/${match.profile.slug}#intro`} className="mt-3 inline-block border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper">
                    {t("intro.request_button")}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
