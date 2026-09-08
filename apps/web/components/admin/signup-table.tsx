"use client"

import { useState } from "react"
import type { SignupRow } from "@/lib/db/signups"
import { useT } from "@/lib/i18n/client"

/** Short enough to scan; the CSV still exports the full register. */
const PAGE_SIZE = 25

/**
 * Paged email table. Lives on the client so Previous / Next do not re-render
 * the whole admin report; the server already sorted and summarised the rows.
 */
export function SignupTable({ rows }: { rows: SignupRow[] }) {
  const t = useT()
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const slice = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const from = rows.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const to = Math.min(rows.length, (safePage + 1) * PAGE_SIZE)

  return (
    <>
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
            {slice.map((signup) => (
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

      {pageCount > 1 ? (
        <nav
          aria-label={t("admin.accounts_pager_label")}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-rule-strong px-3 py-2"
        >
          <p className="tnum text-sm text-ink-soft">
            {t("admin.accounts_page_range", { from, to, total: rows.length })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              className="min-h-11 border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide touch-manipulation enabled:hover:bg-ink enabled:hover:text-paper disabled:border-rule disabled:text-ink-soft sm:min-h-0"
            >
              {t("admin.accounts_prev")}
            </button>
            <p className="tnum text-sm font-semibold">
              {t("admin.accounts_page_of", { page: safePage + 1, pages: pageCount })}
            </p>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
              className="min-h-11 border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide touch-manipulation enabled:hover:bg-ink enabled:hover:text-paper disabled:border-rule disabled:text-ink-soft sm:min-h-0"
            >
              {t("admin.accounts_next")}
            </button>
          </div>
        </nav>
      ) : null}
    </>
  )
}
