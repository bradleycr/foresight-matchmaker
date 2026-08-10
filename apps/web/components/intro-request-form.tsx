"use client"

import { useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"

/**
 * "Request an introduction" — the action keeps this exact name through the
 * whole flow. Neither side sees contact details until the other accepts;
 * this form only carries the ≤500-character message.
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
    return <p className="mt-2 border border-ink bg-paper-shade px-3 py-2">{t("intro.sent", { name: targetName })}</p>
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setError("")

    const res = await fetch("/api/v1/intros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_id: targetId, message }),
    })

    if (res.ok) {
      setStatus("sent")
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? t("intro.error_generic"))
      setStatus("error")
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex max-w-xl flex-col gap-2">
      <p className="text-sm text-ink-soft">{t("intro.explainer")}</p>
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
