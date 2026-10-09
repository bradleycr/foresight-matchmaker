"use client"

import { useCallback, useMemo, useState } from "react"
import type { ChallengeId } from "@/lib/challenges/catalog"
import type { SignupRow } from "@/lib/db/signups"
import {
  NUDGE_MAX_PER_RUN,
  NUDGE_SKIP_EMAILS,
  looksLikeRecipient,
  nudgeDedupeKey,
  signupChallengeId,
} from "@/lib/nudge/policy"
import { useT } from "@/lib/i18n/client"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/primitives"

/** Short enough to scan; the CSV still exports the full register. */
const PAGE_SIZE = 25

function remindable(row: SignupRow, optedOut: ReadonlySet<string>): boolean {
  if (row.status === "listed") return false
  const email = row.contact_email.trim().toLowerCase()
  if (!looksLikeRecipient(email) || NUDGE_SKIP_EMAILS.has(email)) return false
  if (optedOut.has(email)) return false
  return true
}

/**
 * Paged email table. Lives on the client so Previous / Next do not re-render
 * the whole admin report; the server already sorted and summarised the rows.
 */
export function SignupTable({
  rows,
  remind,
}: {
  rows: SignupRow[]
  remind?: {
    challengeId?: ChallengeId
    sentKeys: string[]
    optedOut: string[]
    mailConfigured: boolean
    durable: boolean
  }
}) {
  const t = useT()
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [reminded, setReminded] = useState<Set<string>>(() => new Set(remind?.sentKeys ?? []))
  const optedOut = useMemo(() => new Set(remind?.optedOut ?? []), [remind?.optedOut])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const slice = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const from = rows.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const to = Math.min(rows.length, (safePage + 1) * PAGE_SIZE)

  const pageSelectable = slice.filter((row) => remindable(row, optedOut))
  const allPageSelected = pageSelectable.length > 0 && pageSelectable.every((row) => selected.has(row.contact_email.toLowerCase()))
  const selectedCount = selected.size
  const sendN = Math.min(selectedCount, NUDGE_MAX_PER_RUN)
  const canSend = Boolean(remind?.mailConfigured && remind.durable && selectedCount > 0 && !busy)

  function toggleOne(email: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(email)
      else next.delete(email)
      return next
    })
  }

  function togglePage(on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const row of pageSelectable) {
        const email = row.contact_email.toLowerCase()
        if (on) next.add(email)
        else next.delete(email)
      }
      return next
    })
  }

  const sendSelected = useCallback(async () => {
    if (!remind) return
    setBusy(true)
    setError(null)
    setStatus(null)
    const emails = [...selected].slice(0, NUDGE_MAX_PER_RUN)
    try {
      const res = await fetch("/api/admin/nudges/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(remind.challengeId ? { challenge: remind.challengeId } : {}),
          emails,
        }),
      })
      if (!res.ok) {
        setError(t("admin.nudge_send_error"))
        return
      }
      const body = (await res.json()) as { sent: number; eligible: number; stopped: "quota" | "unconfigured" | null }
      setStatus(
        `${t("admin.nudge_sent", { sent: body.sent, eligible: body.eligible })}${body.stopped === "quota" ? ` ${t("admin.nudge_quota")}` : ""}`,
      )
      setReminded((current) => {
        const next = new Set(current)
        for (const email of emails) {
          const row = rows.find((item) => item.contact_email.toLowerCase() === email)
          if (row) next.add(nudgeDedupeKey(signupChallengeId(row), email))
        }
        return next
      })
      setSelected(new Set())
    } catch {
      setError(t("admin.nudge_send_error"))
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }, [remind, rows, selected, t])

  return (
    <>
      {remind ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 px-3">
          <Button type="button" variant="primary" disabled={!canSend} onClick={() => setConfirm(true)}>
            {t("admin.nudge_send_selected")}
            {selectedCount > 0 ? ` (${sendN})` : ""}
          </Button>
          {selectedCount > 0 ? (
            <p className="text-sm text-ink-soft">{t("admin.nudge_selected", { n: selectedCount })}</p>
          ) : (
            <p className="text-sm text-ink-soft">{t("admin.nudge_select_hint")}</p>
          )}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="px-3 pt-2 text-sm text-alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="px-3 pt-2 text-sm text-ink-soft">
          {status}
        </p>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-y border-rule bg-paper-shade text-left">
              {remind ? (
                <th scope="col" className="w-10 px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    disabled={pageSelectable.length === 0}
                    onChange={(event) => togglePage(event.target.checked)}
                    aria-label={t("admin.nudge_select_page")}
                    className="h-4 w-4 accent-ink"
                  />
                </th>
              ) : null}
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
            {slice.map((signup) => {
              const email = signup.contact_email.toLowerCase()
              const canPick = Boolean(remind && remindable(signup, optedOut))
              const already = reminded.has(nudgeDedupeKey(signupChallengeId(signup), email))
              const stopped = optedOut.has(email)
              return (
                <tr
                  key={signup.contact_email}
                  className={
                    signup.status === "listed"
                      ? "border-b border-rule last:border-0"
                      : "border-b border-rule bg-paper-shade last:border-0"
                  }
                >
                  {remind ? (
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={selected.has(email)}
                        disabled={!canPick}
                        onChange={(event) => toggleOne(email, event.target.checked)}
                        aria-label={signup.contact_email}
                        className="h-4 w-4 accent-ink"
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-1.5">
                    <a href={`mailto:${signup.contact_email}`} className="underline underline-offset-2">
                      {signup.contact_email}
                    </a>
                  </td>
                  <td className="px-3 py-1.5">
                    {t(`admin.status_${signup.status}`)}
                    {already ? (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {t("admin.nudge_reminded")}
                      </span>
                    ) : null}
                    {stopped ? (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {t("admin.nudge_opted_out")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5">{signup.org_name || "—"}</td>
                  <td className="px-3 py-1.5">{signup.kind || "—"}</td>
                  <td className="tnum px-3 py-1.5 text-ink-soft">{signup.created_at.slice(0, 10)}</td>
                </tr>
              )
            })}
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

      {remind ? (
        <ConfirmDialog
          open={confirm}
          title={t("admin.nudge_send_title")}
          body={t("admin.nudge_send_confirm_selected", { n: sendN })}
          confirmLabel={t("admin.nudge_send_selected")}
          cancelLabel={t("admin.nudge_cancel")}
          busy={busy}
          onConfirm={() => void sendSelected()}
          onCancel={() => setConfirm(false)}
        />
      ) : null}
    </>
  )
}
