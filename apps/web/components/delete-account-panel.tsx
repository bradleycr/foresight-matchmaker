"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/client"
import { Button, Input } from "@/components/ui/primitives"
import { DEFAULT_CONTACT_EMAIL } from "@/lib/contact"
import { FailureReportActions } from "@/components/bug-report"

/**
 * GDPR self-service erasure. Lives at the foot of /me so it is reachable
 * but never confused with the ordinary save path. Requires typing the
 * organisation name exactly — same confirmation the API enforces.
 */
export function DeleteAccountPanel({
  profileId,
  orgName,
  privacyEmail,
}: {
  profileId: string
  orgName: string
  privacyEmail: string
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState("")
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const matches = confirm.trim() === orgName

  async function erase() {
    if (!matches || status === "working") return
    setStatus("working")
    setError(null)
    try {
      const res = await fetch(`/api/v1/profiles/${profileId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_org_name: confirm.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? t("me.delete_error"))
        setStatus("error")
        return
      }
      router.push("/register?deleted=1")
      router.refresh()
    } catch {
      setError(t("me.delete_error"))
      setStatus("error")
    }
  }

  return (
    <section className="mt-16 border-t-2 border-rule-strong pt-8" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading" className="font-listing text-xl font-bold uppercase tracking-tight text-alert">
        {t("me.delete_title")}
      </h2>
      <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">{t("me.delete_body")}</p>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        {t("me.delete_email_alt")}{" "}
        <a className="font-semibold text-ink underline underline-offset-2" href={`mailto:${privacyEmail}`}>
          {privacyEmail}
        </a>
      </p>

      {!open ? (
        <Button type="button" variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          {t("me.delete_open")}
        </Button>
      ) : (
        <div className="mt-4 max-w-lg border border-alert bg-paper-shade p-4">
          <p className="text-sm leading-relaxed">{t("me.delete_confirm_prompt", { name: orgName })}</p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide">{t("me.delete_confirm_label")}</span>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={confirm.length > 0 && !matches}
            />
          </label>
          {error ? (
            <div role="alert" className="mt-2 text-sm text-alert">
              <p>{error}</p>
              <FailureReportActions email={DEFAULT_CONTACT_EMAIL} message={error} />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="danger" disabled={!matches || status === "working"} onClick={erase}>
              {status === "working" ? t("me.delete_working") : t("me.delete_confirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={status === "working"}
              onClick={() => {
                setOpen(false)
                setConfirm("")
                setError(null)
                setStatus("idle")
              }}
            >
              {t("me.delete_cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
