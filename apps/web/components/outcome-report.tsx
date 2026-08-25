"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Chip } from "@/components/ui/primitives"
import { DEFAULT_CONTACT_EMAIL } from "@/lib/contact"
import { FailureReportActions } from "@/components/bug-report"

/**
 * The one-click self-report on whether a pairing led to
 * a joint application?" One tap, no form, straight to the metrics.
 */
export function OutcomeReport({
  profileId,
  initial,
}: {
  profileId: string
  initial?: "yes" | "no" | "not_yet" | null
}) {
  const t = useT()
  const [selected, setSelected] = useState<string | null>(initial ?? null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function report(outcome: "yes" | "no" | "not_yet") {
    setSelected(outcome)
    setError(null)
    let res: Response
    try {
      res = await fetch(`/api/v1/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joint_application: outcome }),
      })
    } catch {
      setError(t("outcome.error"))
      return
    }
    if (res.ok) setSaved(true)
    else setError(t("outcome.error"))
  }

  return (
    <div className="mt-6 border border-ink p-4">
      <p className="font-semibold">{t("outcome.question")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(["yes", "not_yet", "no"] as const).map((outcome) => (
          <Chip key={outcome} active={selected === outcome} onClick={() => report(outcome)}>
            {t(`outcome.${outcome}`)}
          </Chip>
        ))}
      </div>
      {saved && (
        <p role="status" className="mt-2 text-sm text-ink-soft">
          {t("outcome.saved")}
        </p>
      )}
      {error && (
        <div role="alert" className="mt-2 text-sm text-alert">
          <p>{error}</p>
          <FailureReportActions email={DEFAULT_CONTACT_EMAIL} message={error} />
        </div>
      )}
    </div>
  )
}
