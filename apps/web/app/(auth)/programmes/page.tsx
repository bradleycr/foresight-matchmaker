import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { peekLiveSession } from "@/lib/auth/live-session"
import { signInHref } from "@/lib/auth/next-path"
import { getT } from "@/lib/i18n/server"
import {
  acceptsNewListings,
  challengeIdOf,
  directoryHref,
  isApplicationChallenge,
  type ChallengeId,
} from "@/lib/challenges/catalog"
import { requestDeskPreference } from "@/lib/challenges/active-programme"
import { requestDemoUnlock, visibleChallenges } from "@/lib/challenges/visibility"
import { challengeTheme } from "@/lib/challenges/themes"
import { ProgrammeStatusTag } from "@/components/programme-status"
import { hydrateListings } from "@/lib/db/durable"
import { getProfilesByEmail } from "@/lib/db/profiles"
import type { Profile } from "@rmm/schema"

export const dynamic = "force-dynamic"

/**
 * Post-sign-in programme desk. Pick a programme; Directory and related
 * masthead links then follow that choice. Account can bring you back here
 * to switch.
 */
export default async function ProgrammesPage() {
  const session = await getSession()
  if (!session) redirect(signInHref("/programmes"))

  await hydrateListings()
  const [{ t }, unlock, live, desk] = await Promise.all([
    getT(),
    requestDemoUnlock(),
    peekLiveSession(),
    requestDeskPreference(),
  ])
  const programmes = visibleChallenges(unlock)
  const listings = getProfilesByEmail(session.email)
  const listingByChallenge = new Map<ChallengeId, Profile>(
    listings.map((p) => [challengeIdOf(p.challenge_id), p]),
  )
  const activeDesk =
    desk && programmes.some((c) => c.id === desk)
      ? desk
      : live?.profile.challenge_id ?? null

  return (
    <div className="py-8">
      <p className="font-listing text-sm font-bold uppercase tracking-widest text-teal">
        {t("programmes.kicker")}
      </p>
      <h1 className="mt-2 max-w-2xl font-listing text-3xl font-bold uppercase tracking-tight sm:text-4xl">
        {t("programmes.title")}
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft">{t("programmes.intro")}</p>

      <ul className="mt-10 grid gap-4">
        {programmes.map((challenge) => {
          const listing = listingByChallenge.get(challenge.id)
          const open = acceptsNewListings(challenge.id)
          const isDesk = activeDesk === challenge.id
          const enterDirectory = `/api/v1/desk?challenge=${challenge.id}&next=${encodeURIComponent(directoryHref(challenge.id))}`
          const enterListing = listing
            ? `/api/v1/desk?challenge=${challenge.id}&next=${encodeURIComponent("/me")}`
            : null
          const enterRegister =
            open && !listing
              ? `/api/v1/desk?challenge=${challenge.id}&next=${encodeURIComponent(`/register?challenge=${challenge.id}`)}`
              : null

          return (
            <li key={challenge.id}>
              <div
                className="border-2 border-rule-strong bg-paper p-5"
                style={{ borderLeftWidth: "4px", borderLeftColor: challengeTheme(challenge.id).accent }}
              >
                <h2 className="flex flex-wrap items-center gap-x-3 gap-y-2 font-listing text-2xl font-bold uppercase leading-none tracking-tight">
                  {t(`challenge.${challenge.id}.name`)}
                  <ProgrammeStatusTag challenge={challenge} t={t} />
                  {isDesk ? (
                    <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-teal">
                      {t("programmes.current_desk")}
                    </span>
                  ) : null}
                </h2>
                <p className="mt-2 max-w-xl text-ink-soft">{t(`challenge.${challenge.id}.blurb`)}</p>
                {listing ? (
                  <p className="mt-2 text-sm text-ink-soft">
                    {t("programmes.your_listing", { name: listing.org_name })}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  {enterListing ? (
                    <Link
                      href={enterListing}
                      className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
                    >
                      {t("programmes.enter_listing")}
                    </Link>
                  ) : null}
                  {enterRegister ? (
                    <Link
                      href={enterRegister}
                      className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
                    >
                      {t("programmes.enter_register")}
                    </Link>
                  ) : null}
                  <Link
                    href={enterDirectory}
                    className="inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-teal hover:text-paper"
                  >
                    {t("programmes.enter_directory")}
                  </Link>
                  <Link
                    href={`/challenges/${challenge.slug}`}
                    className="inline-flex min-h-11 items-center px-1 text-sm font-semibold uppercase tracking-wide underline underline-offset-2"
                  >
                    {t("programmes.view_page")}
                  </Link>
                </div>

                {isApplicationChallenge(challenge.id) && open ? (
                  <p className="mt-4 border-t border-rule pt-3 text-sm text-ink-soft">
                    {t(`challenge.${challenge.id}.host_note`)}{" "}
                    <a
                      href={challenge.hostUrl}
                      className="font-semibold text-ink underline underline-offset-2"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {t(`challenge.${challenge.id}.host_link`)}
                    </a>
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-10 max-w-2xl text-sm text-ink-soft">
        {t("programmes.account_hint")}{" "}
        <Link href="/account" className="font-semibold text-ink underline underline-offset-2">
          {t("nav.account")}
        </Link>
        .
      </p>
    </div>
  )
}
