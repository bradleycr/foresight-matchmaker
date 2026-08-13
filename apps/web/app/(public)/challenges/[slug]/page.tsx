import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { apiFetch } from "@/lib/api/server-fetch"
import type { DirectoryStatsPayload } from "@/lib/api/types"
import { getT } from "@/lib/i18n/server"
import { CHALLENGES, challengeBySlug } from "@/lib/challenges/catalog"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return CHALLENGES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const challenge = challengeBySlug(slug)
  if (!challenge) return {}
  const { t } = await getT()
  return {
    title: `${t(`challenge.${challenge.id}.name`)} — Foresight Matchmaking`,
    description: t(`challenge.${challenge.id}.blurb`),
  }
}

/**
 * One programme inside Foresight Matchmaking. Schema, matching, and
 * challenge-host facts live here — the rest of the chrome is Foresight.
 */
export default async function ChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const challenge = challengeBySlug(slug)
  if (!challenge) notFound()

  const { t } = await getT()
  const stats = (await apiFetch("/api/v1/stats").then((r) => r.json())) as DirectoryStatsPayload
  const counts = stats.by_challenge?.[challenge.id] ?? { data_holder: 0, ai_team: 0, consortium: 0 }
  const id = challenge.id

  const facts = [
    [t("landing.fact_deadline_label"), t("landing.fact_deadline")],
    [t("landing.fact_webinar_label"), t("landing.fact_webinar")],
    [t("landing.fact_stages_label"), t("landing.fact_stages")],
    [t("landing.fact_funding_label"), t("landing.fact_funding")],
    [t("landing.fact_hq_label"), t("landing.fact_hq")],
    [t("landing.fact_dataset_label"), t("landing.fact_dataset")],
    [t("landing.fact_funding_rule_label"), t("landing.fact_funding_rule")],
  ] as const

  return (
    <div className="py-8">
      <p className="font-listing text-sm font-bold uppercase tracking-widest text-teal">
        {t(`challenge.${id}.kicker`)}
      </p>
      <h1 className="mt-2 max-w-3xl font-listing text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">
        {t(`challenge.${id}.name`)}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed">{t(`challenge.${id}.intro`)}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/directory?challenge=${challenge.id}`}
          className="inline-flex min-h-12 items-center border border-ink bg-mark px-6 text-base font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("challenge.cta_directory")}
        </Link>
        <Link
          href={`/register?challenge=${challenge.id}`}
          className="inline-flex min-h-12 items-center border border-ink px-6 text-base font-semibold uppercase tracking-wide hover:bg-teal hover:text-paper"
        >
          {t("challenge.cta_register")}
        </Link>
      </div>

      <dl className="mt-12 grid grid-cols-1 gap-px border border-rule-strong bg-rule-strong sm:grid-cols-3">
        {(
          [
            ["data_holder", t("landing.count_data_holders")],
            ["ai_team", t("landing.count_ai_teams")],
            ["consortium", t("landing.count_consortia")],
          ] as const
        ).map(([kind, label]) => (
          <div key={kind} className="bg-paper px-4 py-5">
            <dd className="tnum font-listing text-5xl font-bold">{counts[kind]}</dd>
            <dt className="mt-1 text-sm font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      <section aria-labelledby="facts" className="mt-12 max-w-3xl">
        <h2 id="facts" className="border-b-2 border-teal pb-1 font-listing text-xl font-bold uppercase">
          {t("landing.facts_title")}
        </h2>
        <dl className="divide-y divide-rule">
          {facts.map(([label, value]) => (
            <div key={label} className="grid gap-x-4 py-2 sm:grid-cols-[14rem_1fr]">
              <dt className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
              <dd className="tnum text-base">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-8 max-w-2xl text-sm text-ink-soft">
        {t(`challenge.${id}.host_note`)}{" "}
        <a href={challenge.hostUrl} className="font-semibold text-ink underline" rel="noopener noreferrer" target="_blank">
          {t("footer.challenge_page")}
        </a>
      </p>
    </div>
  )
}
