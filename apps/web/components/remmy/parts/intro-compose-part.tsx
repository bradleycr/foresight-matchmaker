"use client"

import { useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"

/**
 * Generative UI: intro compose inside the Remmy thread.
 * Remmy may draft the message; the human alone POSTs /api/v1/intros.
 */
export function IntroComposePart({
  toId,
  toName,
  toSlug,
  draftMessage,
  embedded = false,
}: {
  toId: string
  toName: string
  toSlug: string
  draftMessage: string
  embedded?: boolean
}) {
  const t = useT()
  const [message, setMessage] = useState(draftMessage.slice(0, 500))
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState("")

  if (status === "sent") {
    return (
      <p className="border border-ink bg-paper-shade px-3 py-2 text-sm">
        {t("intro.sent", { name: toName })}
      </p>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setError("")
    const res = await fetch("/api/v1/intros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_id: toId, message }),
    })
    if (res.ok) {
      setStatus("sent")
      return
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setError(body.error ?? t("intro.error_generic"))
    setStatus("error")
  }

  return (
    <form onSubmit={submit} className={embedded ? "" : "border border-ink bg-paper-shade p-3"}>
      <p className="font-listing text-sm font-bold uppercase tracking-wide">
        {t("guide.intro_title", { name: toName })}
      </p>
      <p className="mt-1 text-xs text-ink-soft">{t("guide.intro_body")}</p>
      <Textarea
        required
        maxLength={500}
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="mt-2"
        aria-label={t("intro.message_label")}
      />
      <p className="tnum mt-1 text-right text-xs text-ink-faint">{message.length}/500</p>
      {error ? (
        <p role="alert" className="mt-2 border border-alert px-2 py-1 text-sm text-alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={status === "sending"}>
          {status === "sending" ? t("guide.intro_sending") : t("intro.request_button")}
        </Button>
        <Link
          href={`/profile/${toSlug}`}
          className="inline-flex min-h-11 items-center px-3 text-sm font-semibold underline underline-offset-2"
        >
          {t("guide.view_profile")}
        </Link>
      </div>
    </form>
  )
}
