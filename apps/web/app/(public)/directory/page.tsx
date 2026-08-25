import Link from "next/link"
import { redirect } from "next/navigation"
import { getT } from "@/lib/i18n/server"
import { getSession } from "@/lib/auth/session"
import { peekLiveSession } from "@/lib/auth/live-session"
import { signInHref } from "@/lib/auth/next-path"
import {
  CHALLENGES,
  browseDirectoryPath,
  directoryHref,
} from "@/lib/challenges/catalog"
import { challengeTheme } from "@/lib/challenges/themes"
import { DirectoryBrowser } from "@/components/directory/browser"
import { kindCountTotal } from "@/components/listing-counts"
import { hydrateListings } from "@/lib/db/durable"
import { countVisibleProfilesByChallenge, listDirectoryProfiles } from "@/lib/db/profiles"
import type { DirectoryProfile } from "@/lib/api/types"

export const dynamic = "force-dynamic"

/**
 * Programme directory. Unsigned visitors sign in first. Listings are loaded
 * on this request (not via a second API hop) so a profile published a moment
 * ago is in the same corpus the browser renders.
 */
export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>
}) {
  const session = await getSession()
  if (!session) redirect(signInHref("/directory"))

  await hydrateListings()

  const { challenge: raw } = await searchParams
  const selected = raw ? CHALLENGES.find((c) => c.id === raw) : undefined

  if (!selected) {
    const live = await peekLiveSession()
    const dest = browseDirectoryPath(live?.profile.challenge_id)
    if (dest !== "/directory") redirect(dest)

    const { t } = await getT()
    const byChallenge = countVisibleProfilesByChallenge()
    const empty = { data_holder: 0, ai_team: 0, consortium: 0, individual: 0 }

    return (
      <div className="py-6">
        <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("directory.choose_title")}</h1>
        <p className="mt-2 max-w-xl text-ink-soft">{t("directory.choose_intro")}</p>
        <ul className="mt-8 grid gap-4">
          {CHALLENGES.map((challenge) => {
            const counts = byChallenge[challenge.id] ?? empty
            return (
              <li key={challenge.id}>
                <Link
                  href={directoryHref(challenge.id)}
                  className="block border-2 border-rule-strong bg-paper p-5 hover:bg-paper-shade"
                  style={{ borderLeftWidth: "4px", borderLeftColor: challengeTheme(challenge.id).accent }}
                >
                  <h2 className="font-listing text-2xl font-bold uppercase leading-none tracking-tight">
                    {t(`challenge.${challenge.id}.name`)}
                  </h2>
                  <p className="mt-2 max-w-xl text-ink-soft">{t(`challenge.${challenge.id}.blurb`)}</p>
                  {kindCountTotal(counts) > 0 ? (
                    <p className="mt-3 tnum text-sm text-ink-soft">
                      {kindCountTotal(counts)} {t("directory.title").toLowerCase()}
                    </p>
                  ) : null}
                  <p className="mt-4 text-sm font-semibold uppercase tracking-wide underline underline-offset-2">
                    {t("directory.choose_open")} →
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const { t } = await getT()
  const profiles = listDirectoryProfiles({ includeAuthenticatedOnly: true }) as unknown as DirectoryProfile[]
  const name = t(`challenge.${selected.id}.name`)

  return (
    <div className="py-6">
      <p className="font-listing text-sm font-bold uppercase tracking-widest text-teal">
        {t(`challenge.${selected.id}.kicker`)}
      </p>
      <h1 className="mb-4 font-listing text-3xl font-bold uppercase tracking-tight">
        {t("directory.programme_title", { programme: name })}
      </h1>
      <DirectoryBrowser profiles={profiles} />
    </div>
  )
}
