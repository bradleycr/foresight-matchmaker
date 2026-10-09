"use client"

import { useCallback, useState } from "react"
import type { ChallengeId } from "@/lib/challenges/catalog"
import { useT } from "@/lib/i18n/client"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

/**
 * Operator switch for the week-later drip. Writes a durable override so
 * the catalogue default can change without a deploy.
 */
export function AutoNudgeToggle({
  challengeId,
  programmeName,
  enabled,
  durable,
}: {
  challengeId: ChallengeId
  programmeName: string
  enabled: boolean
  durable: boolean
}) {
  const t = useT()
  const [on, setOn] = useState(enabled)
  const [pending, setPending] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const commit = useCallback(
    async (next: boolean) => {
      setBusy(true)
      setError(null)
      const previous = on
      setOn(next)
      setPending(null)
      try {
        const res = await fetch("/api/admin/nudges", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challenge: challengeId, autoNudge: next }),
        })
        if (!res.ok) {
          setOn(previous)
          setError(t("admin.nudge_error"))
          return
        }
      } catch {
        setOn(previous)
        setError(t("admin.nudge_error"))
      } finally {
        setBusy(false)
      }
    },
    [challengeId, on, t],
  )

  function onToggle() {
    if (busy || !durable) return
    const next = !on
    if (next) {
      setPending(true)
      return
    }
    void commit(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t("admin.nudge_auto")}
          disabled={busy || !durable}
          onClick={onToggle}
          className="inline-flex min-h-11 items-center gap-3 border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide touch-manipulation enabled:hover:bg-ink enabled:hover:text-paper disabled:border-rule disabled:text-ink-soft"
        >
          <span
            aria-hidden
            className={`inline-block h-3 w-3 border border-ink ${on ? "bg-mark" : "bg-transparent"}`}
          />
          {t("admin.nudge_auto")}: {on ? t("admin.nudge_on") : t("admin.nudge_off")}
        </button>
        {busy ? <p className="text-sm text-ink-soft">{t("admin.nudge_saving")}</p> : null}
      </div>
      {!durable ? <p className="mt-2 text-sm text-ink-soft">{t("admin.nudge_need_durable")}</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={pending === true}
        title={t("admin.nudge_enable_title")}
        body={t("admin.nudge_enable_body", { name: programmeName })}
        confirmLabel={t("admin.nudge_on")}
        cancelLabel={t("admin.nudge_cancel")}
        busy={busy}
        onConfirm={() => void commit(true)}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
