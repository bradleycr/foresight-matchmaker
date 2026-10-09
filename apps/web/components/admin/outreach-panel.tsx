"use client"

import { useMemo, useState } from "react"
import type { SignupRow } from "@/lib/db/signups"
import { summarizeOutreach } from "@/lib/nudge/outreach"
import { useT } from "@/lib/i18n/client"

const PAGE = 20

type Tab = "not_yet" | "reached"

/**
 * Who this desk has already mailed a listing reminder, and who is still
 * unpublished with no reminder on file.
 */
export function OutreachPanel({
  signups,
  sentKeys,
  optedOut,
}: {
  signups: SignupRow[]
  sentKeys: string[]
  optedOut: string[]
}) {
  const t = useT()
  const sent = useMemo(() => new Set(sentKeys), [sentKeys])
  const stopped = useMemo(() => new Set(optedOut), [optedOut])
  const buckets = useMemo(() => summarizeOutreach(signups, sent, stopped), [signups, sent, stopped])
  const [tab, setTab] = useState<Tab>("not_yet")
  const [page, setPage] = useState(0)

  const rows = tab === "not_yet" ? buckets.notRemindedUnfinished : buckets.remindedUnfinished
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const slice = rows.slice(safePage * PAGE, (safePage + 1) * PAGE)

  function switchTab(next: Tab) {
    setTab(next)
    setPage(0)
  }

  return (
    <section aria-labelledby="admin-outreach" className="mt-6 border border-rule-strong">
      <h2 id="admin-outreach" className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
        {t("admin.outreach_title")}
      </h2>
      <p className="px-3 pt-3 text-sm leading-relaxed text-ink-soft">{t("admin.outreach_body")}</p>

      <dl className="mt-3 grid grid-cols-1 gap-px border-y border-rule-strong bg-rule-strong sm:grid-cols-3">
        {(
          [
            [t("admin.outreach_not_yet"), buckets.notRemindedUnfinished.length],
            [t("admin.outreach_reached"), buckets.remindedUnfinished.length],
            [t("admin.outreach_listed_after"), buckets.remindedListed],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-paper px-3 py-3">
            <dd className="tnum font-listing text-2xl font-bold">{value}</dd>
            <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2 px-3 pt-3">
        <button
          type="button"
          aria-pressed={tab === "not_yet"}
          onClick={() => switchTab("not_yet")}
          className={`min-h-11 border px-3 py-1.5 text-sm font-semibold uppercase tracking-wide touch-manipulation ${
            tab === "not_yet" ? "border-ink bg-mark text-mark-ink" : "border-ink hover:bg-ink hover:text-paper"
          }`}
        >
          {t("admin.outreach_not_yet")} ({buckets.notRemindedUnfinished.length})
        </button>
        <button
          type="button"
          aria-pressed={tab === "reached"}
          onClick={() => switchTab("reached")}
          className={`min-h-11 border px-3 py-1.5 text-sm font-semibold uppercase tracking-wide touch-manipulation ${
            tab === "reached" ? "border-ink bg-mark text-mark-ink" : "border-ink hover:bg-ink hover:text-paper"
          }`}
        >
          {t("admin.outreach_reached")} ({buckets.remindedUnfinished.length})
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ink-soft">{t("admin.outreach_empty")}</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
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
                    {t("admin.accounts_created")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {slice.map((signup) => (
                  <tr key={signup.contact_email} className="border-b border-rule bg-paper-shade last:border-0">
                    <td className="px-3 py-1.5">
                      <a href={`mailto:${signup.contact_email}`} className="underline underline-offset-2">
                        {signup.contact_email}
                      </a>
                    </td>
                    <td className="px-3 py-1.5">{t(`admin.status_${signup.status}`)}</td>
                    <td className="px-3 py-1.5">{signup.org_name || "—"}</td>
                    <td className="tnum px-3 py-1.5 text-ink-soft">{signup.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 ? (
            <nav
              aria-label={t("admin.outreach_pager")}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-rule-strong px-3 py-2"
            >
              <p className="tnum text-sm text-ink-soft">
                {t("admin.accounts_page_range", {
                  from: safePage * PAGE + 1,
                  to: Math.min(rows.length, (safePage + 1) * PAGE),
                  total: rows.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  className="min-h-11 border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide enabled:hover:bg-ink enabled:hover:text-paper disabled:border-rule disabled:text-ink-soft"
                >
                  {t("admin.accounts_prev")}
                </button>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                  className="min-h-11 border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide enabled:hover:bg-ink enabled:hover:text-paper disabled:border-rule disabled:text-ink-soft"
                >
                  {t("admin.accounts_next")}
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </section>
  )
}
