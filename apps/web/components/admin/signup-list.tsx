import {
  mailtoBcc,
  sortSignupsForOperator,
  summarizeSignups,
  withSignupQuery,
  type SignupRow,
} from "@/lib/db/signups"
import type { T } from "@/lib/i18n"

/**
 * Contactable register of every email that requested a magic link.
 *
 * The drop-off between a signup and a listing is the operator's bug-and-
 * reminder list: people who confirmed an email and never published.
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
  const mailtoCohort =
    summary.unfinishedConfirmedEmails.length > 0
      ? summary.unfinishedConfirmedEmails
      : summary.unfinishedEmails
  const mailto = mailtoBcc(mailtoCohort, t("admin.unfinished_subject"), t("admin.unfinished_body"))
  const unfinishedCsv = withSignupQuery(exportHref, { status: "unfinished" })
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
      <p className="px-3 pt-1 text-sm leading-relaxed text-ink-soft">{t("admin.unfinished_hint")}</p>

      {summary.unfinished > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3 px-3">
          {mailto ? (
            <a
              href={mailto}
              className="border border-ink bg-mark px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
            >
              {t("admin.unfinished_email", { n: mailtoCohort.length })}
            </a>
          ) : null}
          <a
            href={unfinishedCsv}
            className="border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
          >
            {t("admin.unfinished_export")}
          </a>
        </div>
      ) : null}

      {signups.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ink-soft">{t("admin.no_data")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-y border-rule bg-paper-shade text-left">
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_email")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_status")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_org")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_kind")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_created")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((signup) => (
                <tr
                  key={signup.contact_email}
                  className={
                    signup.status === "listed"
                      ? "border-b border-rule last:border-0"
                      : "border-b border-rule bg-paper-shade last:border-0"
                  }
                >
                  <td className="px-3 py-1.5">
                    <a href={`mailto:${signup.contact_email}`} className="underline underline-offset-2">
                      {signup.contact_email}
                    </a>
                  </td>
                  <td className="px-3 py-1.5">{t(`admin.status_${signup.status}`)}</td>
                  <td className="px-3 py-1.5">{signup.org_name || "—"}</td>
                  <td className="px-3 py-1.5">{signup.kind || "—"}</td>
                  <td className="tnum px-3 py-1.5 text-ink-soft">{signup.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
