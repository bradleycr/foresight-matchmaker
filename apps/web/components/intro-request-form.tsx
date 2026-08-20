"use client"

import { useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"

/**
 * Email an introduction. The recipient (and a copy to you) goes out over
 * SMTP; the conversation continues in ordinary email. This site keeps a
 * record under Contacts.
 */
export function IntroRequestForm({
  targetId,
  targetName,
  signedIn,
}: {
  targetId: string
  targetName: string
  signedIn: boolean
}) {
  const t = useT()
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState("")
  const [emailSent, setEmailSent] = useState(true)
  const [contactEmail, setContactEmail] = useState<string | null>(null)

  if (!signedIn) {
    return (
      <p className="mt-2">
        {t("intro.signin_first")}{" "}
        <Link href="/signin" className="font-semibold underline">
          {t("nav.signin")}
        </Link>
      </p>
    )
  }

  if (status === "sent") {
    return (
      <div className="mt-2 border border-ink bg-paper-shade px-3 py-2">
        <p>{emailSent ? t("intro.sent", { name: targetName }) : t("intro.sent_logged", { name: targetName })}</p>
        {contactEmail ? (
          <p className="mt-2 text-sm">
            <a href={`mailto:${contactEmail}`} className="font-semibold underline">
              {contactEmail}
            </a>
          </p>
        ) : null}
        <p className="mt-2 text-sm">
          <Link href="/me/inbox" className="font-semibold underline">
            {t("intro.view_contacts")}
          </Link>
        </p>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setError("")

    let res: Response
    try {
      res = await fetch("/api/v1/intros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_id: targetId, message }),
      })
    } catch {
      setError(t("intro.error_network"))
      setStatus("error")
      return
    }

    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      email_sent?: boolean
      intro?: { counterpart?: { contact_email?: string } }
    }

    if (res.ok) {
      setEmailSent(body.email_sent !== false)
      setContactEmail(body.intro?.counterpart?.contact_email ?? null)
      setStatus("sent")
    } else {
      setError(body.error ?? t("intro.error_generic"))
      setStatus("error")
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex max-w-xl flex-col gap-2">
      <Textarea
        required
        maxLength={500}
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("intro.message_placeholder")}
        aria-label={t("intro.message_label")}
      />
      <p className="tnum text-right text-xs text-ink-faint">{message.length}/500</p>
      {error && (
        <p role="alert" className="border border-alert px-3 py-2 text-alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={status === "sending"} className="self-start">
        {t("intro.request_button")}
      </Button>
    </form>
  )
}
