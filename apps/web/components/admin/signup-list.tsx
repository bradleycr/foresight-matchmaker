import { sortSignupsForOperator, summarizeSignups, type SignupRow } from "@/lib/db/signups"
import type { T } from "@/lib/i18n"
import { SignupTable } from "./signup-table"

/**
 * Contactable register of every email that requested a magic link.
 *
 * The drop-off between a signup and a listing is the operator's bug-and-
 * reminder list: people who confirmed an email and never published. The
 * table pages on the client so a long register does not bury the rest of
 * the desk; the summary and CSV still cover every row.
 */
export function SignupList({
  signups,
  t,
  exportHref = "/api/admin/signups?format=csv",
}: {
  signups: SignupRow[]
  t: T
  exportHref?: string
}) {
  const summary = summarizeSignups(signups)
  const ordered = sortSignupsForOperator(signups)
  const conversion =
    summary.total === 0 ? null : Math.round((summary.listed / summary.total) * 100)

  return (
    <section aria-labelledby="admin-accounts" className="mt-6 border border-rule-strong">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-rule-strong bg-paper-shade px-3 py-2">
        <h2 id="admin-accounts" className="font-listing text-base font-bold uppercase">
          {t("admin.accounts_title")}
        </h2>
        <a
          href={exportHref}
          className="border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {t("admin.accounts_export")}
        </a>
      </div>

      <p className="px-3 pt-3 text-sm leading-relaxed text-ink-soft">{t("admin.accounts_body")}</p>

      <dl className="mt-3 grid grid-cols-2 gap-px border-y border-rule-strong bg-rule-strong sm:grid-cols-4">
        {(
          [
            [t("admin.funnel_signups"), summary.total],
            [t("admin.funnel_signed_in"), summary.signed_in],
            [t("admin.funnel_profiles"), summary.listed],
            [t("admin.funnel_unfinished"), summary.unfinished],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-paper px-3 py-3">
            <dd className="tnum font-listing text-2xl font-bold">{value}</dd>
            <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      <p className="px-3 pt-3 text-sm leading-relaxed text-ink-soft">
        {conversion === null
          ? t("admin.accounts_count", { n: summary.total })
          : t("admin.accounts_conversion", { listed: summary.listed, total: summary.total, pct: conversion })}
      </p>

      {signups.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ink-soft">{t("admin.no_data")}</p>
      ) : (
        <SignupTable rows={ordered} />
      )}
    </section>
  )
}
