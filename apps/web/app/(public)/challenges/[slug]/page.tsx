import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { CHALLENGES, challengeBySlug, PLATFORM, RECODING_MATCHMAKING_EVENTS, RECODING_MATCHMAKING_EVENT_URLS } from "@/lib/challenges/catalog"
import { ListingCounts } from "@/components/listing-counts"
import { hydrateListings } from "@/lib/db/durable"
import { countVisibleProfilesByChallenge } from "@/lib/db/profiles"

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

  const [{ t }, live] = await Promise.all([getT(), peekLiveSession()])
  await hydrateListings({ force: true })
  const byChallenge = countVisibleProfilesByChallenge()
  const counts = byChallenge[challenge.id] ?? { data_holder: 0, ai_team: 0, consortium: 0, individual: 0 }
  const id = challenge.id

  const facts = [
    [t("landing.fact_deadline_label"), t("landing.fact_deadline")],
    [t("landing.fact_webinar_label"), t("landing.fact_webinar")],
    [t("landing.fact_stages_label"), t("landing.fact_stages")],
    [t("landing.fact_funding_label"), t("landing.fact_funding")],
    [t("landing.fact_hq_label"), t("landing.fact_hq")],
    [t("landing.fact_dataset_label"), t("landing.fact_dataset")],
  ] as const

  return (
    <div className="py-8">
      <p className="font-listing text-sm font-bold uppercase tracking-widest text-teal">
        {t(`challenge.${id}.kicker`)}
      </p>
      <h1 className="mt-2 max-w-3xl font-listing text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">
        {t(`challenge.${id}.name`)}
      </h1>

      <p className="mt-5 max-w-xl text-ink-soft">{t(`challenge.${id}.intro`)}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/directory?challenge=${challenge.id}`}
          className="inline-flex min-h-12 items-center border border-ink bg-mark px-6 text-base font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("challenge.cta_directory")}
        </Link>
        <Link
          href={live ? "/me" : `/register?challenge=${challenge.id}`}
          className="inline-flex min-h-12 items-center border border-ink px-6 text-base font-semibold uppercase tracking-wide hover:bg-teal hover:text-paper"
        >
          {t(live ? "nav.me" : "nav.register")}
        </Link>
      </div>

      <div className="mt-12">
        <ListingCounts counts={counts} t={t} />
      </div>

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

      {id === "recoding_medicine" ? (
        <section aria-labelledby="matchmaking-events" className="mt-12 max-w-3xl">
          <h2
            id="matchmaking-events"
            className="border-b-2 border-teal pb-1 font-listing text-xl font-bold uppercase"
          >
            {t("challenge.matchmaking_events_title")}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">{t("challenge.matchmaking_events_intro")}</p>
          <p className="mt-3 text-base leading-relaxed">{t("challenge.matchmaking_events_limit")}</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-base">
            {RECODING_MATCHMAKING_EVENTS.map((key) => (
              <li key={key}>
                <a
                  href={RECODING_MATCHMAKING_EVENT_URLS[key]}
                  className="font-semibold underline underline-offset-2"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t(`enum.attending.${key}`)}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-5">
            <a
              href={PLATFORM.lumaCalendarUrl}
              className="font-semibold underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("challenge.matchmaking_events_luma")}
            </a>
          </p>
        </section>
      ) : null}

      <p className="mt-8">
        <a href={challenge.hostUrl} className="font-semibold underline" rel="noopener noreferrer" target="_blank">
          {t("footer.challenge_page")}
        </a>
      </p>
    </div>
  )
}
