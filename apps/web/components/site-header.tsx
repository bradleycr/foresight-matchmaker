import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import { ForesightMark } from "./foresight-mark"
import { LocaleSwitcher } from "./locale-switcher"

/**
 * Masthead: Foresight’s publisher plate beside the product title, then a
 * plain destination row. The yellow plate is the brand signal; condensed
 * listing type carries the product name.
 */
export async function SiteHeader() {
  const { t } = await getT()
  const session = await getSession()

  return (
    <header className="border-b-2 border-rule-strong">
      <div className="flex items-start justify-between gap-4 pt-5 pb-3">
        <Link
          href="/"
          className="group flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
        >
          <ForesightMark />
          <span className="min-w-0">
            <span className="block font-listing text-2xl font-bold uppercase leading-none tracking-tight sm:text-3xl">
              {t("app.title")}
            </span>
            <span className="mt-1.5 block text-sm text-teal-deep">{t("app.tagline")}</span>
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
        {session ? (
          <>
            <Link href="/directory" className="hover:underline">
              {t("nav.directory")}
            </Link>
            <Link href="/me/matches" className="hover:underline">
              {t("nav.matches")}
            </Link>
            <Link href="/me/inbox" className="hover:underline">
              {t("nav.inbox")}
            </Link>
            <Link href="/me" className="hover:underline">
              {t("nav.me")}
            </Link>
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
