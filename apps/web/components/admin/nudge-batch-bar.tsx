"use client"

import { useCallback, useMemo, useState } from "react"
import type { ChallengeId } from "@/lib/challenges/catalog"
import type { SignupRow } from "@/lib/db/signups"
import { NUDGE_MAX_PER_RUN, NUDGE_SKIP_EMAILS, looksLikeRecipient, nudgeDedupeKey, signupChallengeId } from "@/lib/nudge/policy"
import { useT } from "@/lib/i18n/client"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Button } from "@/components/ui/primitives"

export type NudgeSendResult = {
  sent: number
  failed: number
  eligible: number
  stopped: "quota" | "unconfigured" | null
}

function remindable(row: SignupRow, optedOut: ReadonlySet<string>): boolean {
  if (row.status === "listed") return false
  const email = row.contact_email.trim().toLowerCase()
  if (!looksLikeRecipient(email) || NUDGE_SKIP_EMAILS.has(email)) return false
  if (optedOut.has(email)) return false
  return true
}

/**
 * Send unpublished reminders for one programme, skipping anyone already
 * mailed or opted out. Selected rows are handled on the table.
 */
export function NudgeBatchBar({
  challengeId,
  signups,
  sentKeys,
  optedOut,
  mailConfigured,
  durable,
}: {
  challengeId: ChallengeId
  signups: SignupRow[]
  sentKeys: string[]
  optedOut: string[]
  mailConfigured: boolean
  durable: boolean
}) {
  const t = useT()
  const opted = useMemo(() => new Set(optedOut), [optedOut])
  const sent = useMemo(() => new Set(sentKeys), [sentKeys])
  const eligible = useMemo(
    () =>
      signups.filter((row) => {
        if (!remindable(row, opted)) return false
        return !sent.has(nudgeDedupeKey(signupChallengeId(row), row.contact_email))
      }).length,
    [signups, opted, sent],
  )

  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<NudgeSendResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/nudges/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge: challengeId, unfinished: true }),
      })
      if (!res.ok) {
        setError(t("admin.nudge_send_error"))
        return
      }
      const body = (await res.json()) as NudgeSendResult
      setResult(body)
    } catch {
      setError(t("admin.nudge_send_error"))
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }, [challengeId, t])

  const canSend = mailConfigured && durable && eligible > 0 && !busy
  const n = Math.min(eligible, NUDGE_MAX_PER_RUN)

  return (
    <div className="mt-4">
      <p className="text-sm leading-relaxed text-ink-soft">
        {t("admin.nudge_batch_hint", { n: eligible, cap: NUDGE_MAX_PER_RUN })}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" disabled={!canSend} onClick={() => setConfirm(true)}>
          {t("admin.nudge_send_unfinished")}
        </Button>
        {!mailConfigured ? <p className="text-sm text-ink-soft">{t("admin.nudge_need_mail")}</p> : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <p role="status" className="mt-2 text-sm text-ink-soft">
          {t("admin.nudge_sent", { sent: result.sent, eligible: result.eligible })}
          {result.stopped === "quota" ? ` ${t("admin.nudge_quota")}` : ""}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirm}
        title={t("admin.nudge_send_title")}
        body={t("admin.nudge_send_confirm_unfinished", { n })}
        confirmLabel={t("admin.nudge_send_unfinished")}
        cancelLabel={t("admin.nudge_cancel")}
        busy={busy}
        onConfirm={() => void send()}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
