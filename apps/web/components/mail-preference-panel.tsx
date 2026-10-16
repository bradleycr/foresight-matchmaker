"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import { DEFAULT_CONTACT_EMAIL } from "@/lib/contact"
import { FailureReportActions } from "@/components/bug-report"

/**
 * Account-wide programme-mail preference. Magic-link sign-in is never gated —
 * only thank-you and future programme announcements.
 */
export function MailPreferencePanel({ initialProgrammeEmails }: { initialProgrammeEmails: boolean }) {
  const t = useT()
  const [programmeEmails, setProgrammeEmails] = useState(initialProgrammeEmails)
  const [status, setStatus] = useState<"idle" | "working" | "saved" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function save(next: boolean) {
    if (status === "working") return
    setStatus("working")
    setError(null)
    const previous = programmeEmails
    setProgrammeEmails(next)
    try {
      const res = await fetch("/api/v1/mail-preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programme_emails: next }),
      })
      if (!res.ok) {
        setProgrammeEmails(previous)
        setError(t("me.mail_error"))
        setStatus("error")
        return
      }
      setStatus("saved")
    } catch {
      setProgrammeEmails(previous)
      setError(t("me.mail_error"))
      setStatus("error")
    }
  }

  return (
    <section
      id="email"
      className="border-2 border-ink bg-paper p-5"
      aria-labelledby="mail-pref-heading"
    >
      <h2 id="mail-pref-heading" className="font-listing text-xl font-bold uppercase tracking-tight">
        {t("me.mail_title")}
      </h2>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-teal">{t("account.scope_account")}</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("me.mail_body")}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={programmeEmails ? "primary" : "outline"}
          disabled={status === "working" || programmeEmails}
          onClick={() => void save(true)}
        >
          {t("me.mail_on")}
        </Button>
        <Button
          type="button"
          variant={!programmeEmails ? "primary" : "outline"}
          disabled={status === "working" || !programmeEmails}
          onClick={() => void save(false)}
        >
          {t("me.mail_off")}
        </Button>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">
        {programmeEmails ? t("account.mail_status_on") : t("account.mail_status_off")}
      </p>
      {status === "saved" ? (
        <p role="status" className="mt-2 text-sm text-ink-soft">
          {programmeEmails ? t("me.mail_saved_on") : t("me.mail_saved_off")}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="mt-2 text-sm text-alert">
          <p>{error}</p>
          <FailureReportActions email={DEFAULT_CONTACT_EMAIL} message={error} />
        </div>
      ) : null}
    </section>
  )
}
