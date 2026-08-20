import Link from "next/link"
import { apiFetch } from "@/lib/api/server-fetch"
import type { DirectoryStatsPayload } from "@/lib/api/types"
import { getT } from "@/lib/i18n/server"
import { peekLiveSession } from "@/lib/auth/live-session"
import { signInHref } from "@/lib/auth/next-path"
import { CHALLENGES } from "@/lib/challenges/catalog"
import { challengeTheme } from "@/lib/challenges/themes"
import { DirectoryDisclaimer } from "@/components/directory-disclaimer"
import { kindCountTotal } from "@/components/listing-counts"

export const dynamic = "force-dynamic"

/**
 * Foresight Matchmaking home: the platform, then the open programmes.
 * Recoding Medicine facts live on the challenge page, not here.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>
}) {
  const { t } = await getT()
  const { deleted } = await searchParams
  const live = await peekLiveSession()
  const stats = (await apiFetch("/api/v1/stats").then((r) => r.json())) as DirectoryStatsPayload
  const empty = { data_holder: 0, ai_team: 0, consortium: 0, individual: 0 }
  const directoryHref = live ? "/directory" : signInHref("/directory")

  return (
    <div className="py-10">
      {deleted ? (
        <div role="status" className="mb-6 border border-ink bg-paper-shade px-3 py-2">
          <p>{t("landing.deleted")}</p>
          <Link
            href="/register?deleted=1"
            className="mt-2 inline-flex min-h-10 items-center font-semibold uppercase tracking-wide text-ink underline underline-offset-2 hover:no-underline"
          >
            {t("landing.deleted_cta")} →
          </Link>
        </div>
      ) : null}

      <p className="font-listing text-sm font-bold uppercase tracking-widest text-teal">{t("landing.kicker")}</p>
      <h1 className="mt-2 max-w-3xl font-listing text-4xl font-bold uppercase leading-none tracking-tight sm:text-6xl">
        {t("landing.headline")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed">{t("landing.subhead")}</p>

      <DirectoryDisclaimer className="mt-8" />

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={directoryHref}
          className="inline-flex min-h-12 items-center border border-ink bg-mark px-6 text-base font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("landing.cta_browse")}
        </Link>
        <Link
          href="/register"
          className="inline-flex min-h-12 items-center border border-ink px-6 text-base font-semibold uppercase tracking-wide hover:bg-teal hover:text-paper"
        >
          {t("nav.register")}
        </Link>
      </div>

      <section id="programmes" aria-labelledby="programmes-heading" className="mt-16">
        <h2 id="programmes-heading" className="border-b-2 border-teal pb-1 font-listing text-xl font-bold uppercase">
          {t("landing.programmes_title")}
        </h2>

        <ul className="mt-6 grid gap-4">
          {CHALLENGES.map((challenge) => {
            const counts = stats.by_challenge?.[challenge.id] ?? empty
            return (
              <li key={challenge.id}>
                <Link
                  href={`/challenges/${challenge.slug}`}
                  className="block border-2 border-rule-strong bg-paper p-5 hover:bg-paper-shade"
                  style={{ borderLeftWidth: "4px", borderLeftColor: challengeTheme(challenge.id).accent }}
                >
                  <h3 className="font-listing text-2xl font-bold uppercase leading-none tracking-tight sm:text-3xl">
                    {t(`challenge.${challenge.id}.name`)}
                  </h3>
                  <p className="mt-2 max-w-xl text-ink-soft">{t(`challenge.${challenge.id}.blurb`)}</p>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-wide">
                    {t("landing.programme_deadline", { date: challenge.deadlineLabel })}
                  </p>
                  {kindCountTotal(counts) > 0 ? (
                    <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                      <div>
                        <dd className="tnum inline font-listing text-lg font-bold text-ink">{counts.data_holder}</dd>{" "}
                        <dt className="inline">{t("landing.count_data_holders")}</dt>
                      </div>
                      <div>
                        <dd className="tnum inline font-listing text-lg font-bold text-ink">{counts.ai_team}</dd>{" "}
                        <dt className="inline">{t("landing.count_ai_teams")}</dt>
                      </div>
                      <div>
                        <dd className="tnum inline font-listing text-lg font-bold text-ink">{counts.consortium}</dd>{" "}
                        <dt className="inline">{t("landing.count_consortia")}</dt>
                      </div>
                      <div>
                        <dd className="tnum inline font-listing text-lg font-bold text-ink">{counts.individual}</dd>{" "}
                        <dt className="inline">{t("landing.count_individuals")}</dt>
                      </div>
                    </dl>
                  ) : null}
                  <p className="mt-4 text-sm font-semibold uppercase tracking-wide underline underline-offset-2">
                    {t("landing.programme_open")} →
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
