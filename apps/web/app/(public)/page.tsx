import Link from "next/link"
import { apiFetch } from "@/lib/api/server-fetch"
import type { DirectoryPayload } from "@/lib/api/types"
import { getT } from "@/lib/i18n/server"

export const dynamic = "force-dynamic"

/**
 * The landing page states the one fact that matters — an AI team with no
 * dataset cannot apply at all — and routes people into the directory or
 * the profile form. Plain, institutional, unhurried.
 */
export default async function LandingPage() {
  const { t } = await getT()
  const directory = (await apiFetch("/api/v1/directory").then((r) => r.json())) as DirectoryPayload

  const counts = {
    data_holder: directory.profiles.filter((p) => p.kind === "data_holder").length,
    ai_team: directory.profiles.filter((p) => p.kind === "ai_team").length,
    consortium: directory.profiles.filter((p) => p.kind === "consortium").length,
  }

  return (
    <div className="py-10">
      <p className="font-listing text-sm font-bold uppercase tracking-widest text-ink-soft">{t("landing.kicker")}</p>
      <h1 className="mt-2 max-w-3xl font-listing text-4xl font-bold uppercase leading-none tracking-tight sm:text-6xl">
        {t("landing.headline")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed">{t("landing.subhead")}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/directory"
          className="inline-flex min-h-12 items-center border border-ink bg-mark px-6 text-base font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("landing.cta_browse")}
        </Link>
        <Link
          href="/register"
          className="inline-flex min-h-12 items-center border border-ink px-6 text-base font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {t("landing.cta_register")}
        </Link>
      </div>

      {/* Who is listed, in figures. */}
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

      {/* The hard external facts — dates, money, rules. Not marketing. */}
      <section aria-labelledby="facts" className="mt-12 max-w-3xl">
        <h2 id="facts" className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t("landing.facts_title")}
        </h2>
        <dl className="divide-y divide-rule">
          {(
            [
              [t("landing.fact_deadline_label"), t("landing.fact_deadline")],
              [t("landing.fact_webinar_label"), t("landing.fact_webinar")],
              [t("landing.fact_stages_label"), t("landing.fact_stages")],
              [t("landing.fact_funding_label"), t("landing.fact_funding")],
              [t("landing.fact_hq_label"), t("landing.fact_hq")],
              [t("landing.fact_dataset_label"), t("landing.fact_dataset")],
              [t("landing.fact_funding_rule_label"), t("landing.fact_funding_rule")],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid gap-x-4 py-2 sm:grid-cols-[14rem_1fr]">
              <dt className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
              <dd className="tnum text-base">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
