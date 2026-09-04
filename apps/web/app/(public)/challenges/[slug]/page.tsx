import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { CHALLENGES, challengeBySlug, sessionUrl, type ChallengeDef } from "@/lib/challenges/catalog"
import { isChallengeVisible } from "@/lib/challenges/visibility"
import { ListingCounts } from "@/components/listing-counts"
import { ProgrammePreviewNotice } from "@/components/programme-status"
import { hydrateListings } from "@/lib/db/durable"
import { countVisibleProfilesByChallenge } from "@/lib/db/profiles"
import type { T } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return CHALLENGES.map((c) => ({ slug: c.slug }))
}

function visibleChallenge(slug: string): ChallengeDef | undefined {
  const challenge = challengeBySlug(slug)
  if (!challenge || !isChallengeVisible(challenge.id)) return undefined
  return challenge
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const challenge = visibleChallenge(slug)
  if (!challenge) return {}
  const { t } = await getT()
  return {
    title: `${t(`challenge.${challenge.id}.name`)} — Foresight Matchmaking`,
    description: t(`challenge.${challenge.id}.blurb`),
  }
}

/**
 * One programme inside Foresight Matchmaking. Facts and sessions come from
 * the catalog so a second programme does not inherit Recoding Medicine's
 * deadline, webinar, or city series.
 */
export default async function ChallengePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const challenge = visibleChallenge(slug)
  if (!challenge) notFound()

  const [{ t }, live] = await Promise.all([getT(), peekLiveSession()])
  await hydrateListings()
  const byChallenge = countVisibleProfilesByChallenge()
  const counts = byChallenge[challenge.id] ?? { data_holder: 0, ai_team: 0, consortium: 0, individual: 0 }
  const id = challenge.id

  const facts = challenge.factKeys.map((key) => [
    t(`${challenge.factsNamespace}.fact_${key}_label`),
    t(`${challenge.factsNamespace}.fact_${key}`),
  ]) as ReadonlyArray<readonly [string, string]>

  return (
    <div className="py-8">
      <ProgrammePreviewNotice challenge={challenge} t={t} className="mb-8" />

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
        <ListingCounts counts={counts} t={t} captionKey={`challenge.${id}.counts_caption`} />
      </div>

      <FactsSection facts={facts} t={t} />
      <SessionsSection challenge={challenge} t={t} />

      <p className="mt-8">
        <a href={challenge.hostUrl} className="font-semibold underline" rel="noopener noreferrer" target="_blank">
          {t(`challenge.${id}.host_link`)}
        </a>
      </p>
    </div>
  )
}

function FactsSection({
  facts,
  t,
}: {
  facts: ReadonlyArray<readonly [string, string]>
  t: T
}) {
  if (facts.length === 0) return null

  return (
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
  )
}

function SessionsSection({ challenge, t }: { challenge: ChallengeDef; t: T }) {
  if (challenge.sessions.length === 0) return null
  const id = challenge.id

  return (
    <section aria-labelledby="matchmaking-events" className="mt-12 max-w-3xl">
      <h2
        id="matchmaking-events"
        className="border-b-2 border-teal pb-1 font-listing text-xl font-bold uppercase"
      >
        {t(`challenge.${id}.events_title`)}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">{t(`challenge.${id}.events_body`)}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-base">
        {challenge.sessions.map((key) => (
          <li key={key}>
            <a
              href={sessionUrl(challenge, key)}
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
          href={challenge.calendarUrl}
          className="font-semibold underline underline-offset-2"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t(`challenge.${id}.events_luma`)}
        </a>
      </p>
    </section>
  )
}
