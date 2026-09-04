import Link from "next/link"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getSession } from "@/lib/auth/session"
import { signInHref } from "@/lib/auth/next-path"
import { browseDirectoryPath } from "@/lib/challenges/visibility"
import { getT } from "@/lib/i18n/server"
import { BetaBadge } from "./beta-badge"
import { ForesightMark } from "./foresight-mark"
import { LocaleSwitcher } from "./locale-switcher"
import { SignOutButton } from "./sign-out-button"

/**
 * Masthead: clean Foresight wordmark beside the product title, then a
 * plain Unica destination row.
 */
export async function SiteHeader() {
  const { t } = await getT()
  const live = await peekLiveSession()
  const session = live ? live.session : await getSession()
  const directoryHref = session ? browseDirectoryPath(live?.profile.challenge_id) : signInHref("/directory")

  return (
    <header className="border-b-2 border-rule-strong">
      <div className="flex items-start justify-between gap-4 pt-5 pb-3">
        <Link
          href="/"
          className="group flex min-w-0 flex-1 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5"
        >
          <ForesightMark className="h-8 sm:h-9" />
          <span
            aria-hidden="true"
            className="hidden h-8 w-px shrink-0 bg-rule-strong sm:block"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2.5">
              <span className="block font-listing text-2xl uppercase leading-none tracking-tight sm:text-3xl">
                {t("app.title")}
              </span>
              <BetaBadge>{t("app.beta")}</BetaBadge>
              <span className="sr-only">{t("app.beta_hint")}</span>
            </span>
            <span className="mt-1.5 hidden text-sm text-teal-deep sm:block">{t("app.tagline")}</span>
          </span>
        </Link>
        <LocaleSwitcher />
      </div>

      <nav
        aria-label={t("nav.label")}
        className="flex flex-wrap gap-x-5 gap-y-1 border-t border-rule py-2 text-sm font-semibold uppercase tracking-wide"
      >
        <Link href="/#programmes" className="hover:underline">
          {t("nav.programmes")}
        </Link>
        {live ? (
          <>
            <Link href={directoryHref} className="hover:underline">
              {t("nav.directory")}
            </Link>
            <Link href="/me/matches" className="hover:underline">
              {t("nav.matches")}
            </Link>
            <Link href="/me" className="hover:underline">
              {t("nav.me")}
            </Link>
            <SignOutButton className="min-h-0 border-0 px-0 py-0 text-sm font-semibold uppercase tracking-wide underline-offset-4" variant="ghost" />
          </>
        ) : session ? (
          <>
            <Link href={directoryHref} className="hover:underline">
              {t("nav.directory")}
            </Link>
            <Link href="/register" className="hover:underline">
              {t("nav.register")}
            </Link>
            <SignOutButton className="min-h-0 border-0 px-0 py-0 text-sm font-semibold uppercase tracking-wide underline-offset-4" variant="ghost" />
          </>
        ) : (
          <>
            <Link href="/register" className="hover:underline">
              {t("nav.register")}
            </Link>
            <Link href="/signin" className="hover:underline">
              {t("nav.signin")}
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
