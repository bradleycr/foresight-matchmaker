"use client"

import { BetaBadge } from "./beta-badge"
import { ForesightMark } from "./foresight-mark"
import { LocaleSwitcher } from "./locale-switcher"
import { NavLink } from "./nav-link"
import { SignOutButton } from "./sign-out-button"
import { useT } from "@/lib/i18n/client"

/**
 * Visible chrome for the masthead. Strings come from the client dictionary
 * so a language tap repaints this row immediately, before the RSC refresh.
 */
export function SiteMasthead({
  directoryHref,
  signedIn,
  listed,
}: {
  directoryHref: string
  signedIn: boolean
  listed: boolean
}) {
  const t = useT()

  return (
    <header className="border-b-2 border-rule-strong">
      <div className="flex items-start justify-between gap-4 pt-5 pb-3">
        <NavLink
          href="/"
          showPending={false}
          className="group flex min-w-0 flex-1 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5"
        >
          <ForesightMark className="h-8 sm:h-9" />
          <span aria-hidden="true" className="hidden h-8 w-px shrink-0 bg-rule-strong sm:block" />
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
        </NavLink>
        <LocaleSwitcher />
      </div>

      <nav
        aria-label={t("nav.label")}
        className="flex flex-wrap gap-x-5 gap-y-1 border-t border-rule py-2 text-sm font-semibold uppercase tracking-wide"
      >
        <NavLink href="/#programmes" className="hover:underline">
          {t("nav.programmes")}
        </NavLink>
        {listed ? (
          <>
            <NavLink href={directoryHref} className="hover:underline">
              {t("nav.directory")}
            </NavLink>
            <NavLink href="/me/matches" className="hover:underline">
              {t("nav.matches")}
            </NavLink>
            <NavLink href="/me" className="hover:underline">
              {t("nav.me")}
            </NavLink>
            <SignOutButton className="min-h-0 border-0 px-0 py-0 text-sm font-semibold uppercase tracking-wide underline-offset-4" variant="ghost" />
          </>
        ) : signedIn ? (
          <>
            <NavLink href={directoryHref} className="hover:underline">
              {t("nav.directory")}
            </NavLink>
            <NavLink href="/register" className="hover:underline">
              {t("nav.register")}
            </NavLink>
            <SignOutButton className="min-h-0 border-0 px-0 py-0 text-sm font-semibold uppercase tracking-wide underline-offset-4" variant="ghost" />
          </>
        ) : (
          <>
            <NavLink href="/register" className="hover:underline">
              {t("nav.register")}
            </NavLink>
            <NavLink href="/signin" className="hover:underline">
              {t("nav.signin")}
            </NavLink>
          </>
        )}
      </nav>
    </header>
  )
}
