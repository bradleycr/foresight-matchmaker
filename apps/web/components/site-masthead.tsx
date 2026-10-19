"use client"

import { BetaBadge } from "./beta-badge"
import { Nanowheel } from "./nanowheel"
import { LocaleSwitcher } from "./locale-switcher"
import { NavLink } from "./nav-link"
import { SignOutButton } from "./sign-out-button"
import { useT } from "@/lib/i18n/client"
import { PLATFORM } from "@/lib/challenges/catalog"

/**
 * Masthead lockup: nanowheel + Matchmaker.
 *
 * The institute wordmark PNG already embeds the nanotube, so stacking that
 * PNG beside a second wheel muddled the mark. Here the nanowheel is the
 * clear product glyph; Foresight Institute sits as a quiet text credit.
 */
export function SiteMasthead({
  directoryHref,
  programmesHref = "/#programmes",
  signedIn,
  listed,
}: {
  directoryHref: string
  programmesHref?: string
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
          markActive={false}
          className="group flex min-w-0 flex-1 items-start gap-3.5 no-underline sm:items-center sm:gap-4"
        >
          <Nanowheel
            size="hero"
            label="Foresight Matchmaking"
            className="mt-0.5 size-14 shrink-0 sm:mt-0 sm:size-16"
          />
          <span className="min-w-0 pt-0.5">
            <span className="block font-listing text-[11px] font-bold uppercase tracking-[0.18em] text-teal sm:text-xs">
              {PLATFORM.operator}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <span className="font-listing text-3xl uppercase leading-none tracking-tight sm:text-4xl">
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
        <NavLink href={programmesHref} className="hover:underline">
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
            <NavLink href="/account" className="hover:underline">
              {t("nav.account")}
            </NavLink>
            <SignOutButton
              className="min-h-0 border-0 px-0 py-0 text-sm font-semibold uppercase tracking-wide no-underline hover:underline"
              variant="ghost"
            />
          </>
        ) : signedIn ? (
          <>
            <NavLink href={directoryHref} className="hover:underline">
              {t("nav.directory")}
            </NavLink>
            <NavLink href="/register" className="hover:underline">
              {t("nav.register")}
            </NavLink>
            <NavLink href="/account" className="hover:underline">
              {t("nav.account")}
            </NavLink>
            <SignOutButton
              className="min-h-0 border-0 px-0 py-0 text-sm font-semibold uppercase tracking-wide no-underline hover:underline"
              variant="ghost"
            />
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
