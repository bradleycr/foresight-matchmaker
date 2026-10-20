import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { challengeById } from "@/lib/challenges/catalog"
import { hydrateListings } from "@/lib/db/durable"
import { getProfilesByEmail } from "@/lib/db/profiles"
import { isMailOptedOut } from "@/lib/mail/optout-store"
import { MailPreferencePanel } from "@/components/mail-preference-panel"
import { SignOutButton } from "@/components/sign-out-button"
import { signInHref } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

/**
 * Account settings — mailbox-level, not programme-level.
 *
 * Top: programmes and listings (what you came to do). Bottom: email
 * preferences and sign-out (account hygiene).
 */
export default async function AccountPage() {
  const session = await getSession()
  if (!session) redirect(signInHref("/account"))

  await hydrateListings()
  const live = await peekLiveSession()
  const listings = getProfilesByEmail(session.email)
  const programmeEmails = !(await isMailOptedOut(session.email))
  const { t } = await getT()

  return (
    <div className="py-6">
      <div>
        <p className="font-listing text-sm font-bold uppercase tracking-widest text-teal">
          {t("account.kicker")}
        </p>
        <h1 className="mt-2 font-listing text-3xl font-bold uppercase tracking-tight">
          {t("account.title")}
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">{t("account.intro")}</p>
        <p className="mt-3 tnum text-sm text-ink-soft">
          {t("account.signed_in_as")}{" "}
          <span className="font-semibold text-ink">{session.email}</span>
        </p>
      </div>

      <section className="mt-10" aria-labelledby="account-programmes">
        <h2 id="account-programmes" className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t("account.programmes_title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("account.programmes_body")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/programmes"
            className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
          >
            {t("account.switch_programme")}
          </Link>
          <Link
            href="/#programmes"
            className="inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-teal hover:text-paper"
          >
            {t("account.view_open_programmes")}
          </Link>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="account-listings">
        <h2 id="account-listings" className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t("account.listings_title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("account.listings_body")}</p>

        {listings.length === 0 ? (
          <div className="mt-4 border border-rule-strong bg-paper-shade p-4">
            <p className="text-sm leading-relaxed">{t("account.listings_empty")}</p>
            <Link
              href="/programmes"
              className="mt-3 inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
            >
              {t("account.switch_programme")}
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-rule border border-rule-strong">
            {listings.map((profile) => {
              const challenge = challengeById(profile.challenge_id)
              const isActive = live?.profile.id === profile.id
              return (
                <li key={profile.id} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-listing text-base font-bold uppercase leading-tight">{profile.org_name}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {t(`challenge.${challenge.id}.name`)}
                      {isActive ? ` · ${t("account.listing_active")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <Link
                      href={`/api/v1/desk?challenge=${challenge.id}&next=${encodeURIComponent("/me")}`}
                      className="text-sm font-semibold uppercase tracking-wide underline underline-offset-2"
                    >
                      {t("account.edit_listing")}
                    </Link>
                    <Link
                      href={`/api/v1/desk?challenge=${challenge.id}&next=${encodeURIComponent(`/directory?challenge=${challenge.id}`)}`}
                      className="text-sm font-semibold uppercase tracking-wide underline underline-offset-2"
                    >
                      {t("account.open_directory")}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="mt-8 max-w-2xl text-sm text-ink-soft">{t("account.vs_profile")}</p>

      <section className="mt-12 border-t-2 border-rule-strong pt-8" aria-labelledby="account-mail">
        <h2 id="account-mail" className="font-listing text-xl font-bold uppercase">
          {t("account.mail_title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("account.mail_body")}</p>
        <div className="mt-4">
          <MailPreferencePanel initialProgrammeEmails={programmeEmails} />
        </div>
      </section>

      <section className="mt-10 border-t border-rule pt-8" aria-labelledby="account-session">
        <h2 id="account-session" className="font-listing text-xl font-bold uppercase">
          {t("account.session_title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("account.session_body")}</p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </section>
    </div>
  )
}
