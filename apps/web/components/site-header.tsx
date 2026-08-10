import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import { LocaleSwitcher } from "./locale-switcher"

/**
 * Masthead in the manner of a directory cover: the title set large and
 * condensed, a rule beneath, and a plain row of destinations. No icons,
 * no dropdowns.
 */
export async function SiteHeader() {
  const { t } = await getT()
  const session = await getSession()

  return (
    <header className="border-b-2 border-rule-strong">
      <div className="flex items-start justify-between gap-4 pt-5 pb-3">
        <Link href="/" className="block">
          <span className="block font-listing text-2xl font-bold uppercase leading-none tracking-tight sm:text-3xl">
            {t("app.title")}
          </span>
          <span className="mt-1 block text-sm text-ink-soft">{t("app.tagline")}</span>
        </Link>
        <LocaleSwitcher />
      </div>

      <nav aria-label={t("nav.label")} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-rule py-2 text-sm font-semibold uppercase tracking-wide">
        <Link href="/directory" className="hover:underline">
          {t("nav.directory")}
        </Link>
        <Link href="/register" className="hover:underline">
          {t("nav.register")}
        </Link>
        {session ? (
          <>
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
          <Link href="/signin" className="hover:underline">
            {t("nav.signin")}
          </Link>
        )}
      </nav>
    </header>
  )
}
