"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Button, Field, Input } from "@/components/ui/primitives"
import type { DeliveryMode } from "@/lib/auth/mail"

type Result = { ok: true; mode: DeliveryMode; claim_link?: string }

export function SigninForm({ mode }: { mode: DeliveryMode }) {
  const t = useT()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle")
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("working")
    setError(null)

    const res = await fetch("/api/v1/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    if (res.status === 429) {
      setError(t("signin.rate_limited"))
      setStatus("error")
      return
    }

    if (!res.ok) {
      setError(t("signin.error_generic"))
      setStatus("error")
      return
    }

    setResult((await res.json()) as Result)
    setStatus("done")
  }

  if (status === "done" && result) {
    return (
      <div className="mt-6">
        {result.claim_link ? (
          <div className="border border-ink bg-paper-shade p-4">
            <p className="font-semibold">{t("signin.copy_link_warning")}</p>
            <p className="mt-1 text-sm text-ink-soft">{t("signin.copy_link_note")}</p>
            <p className="mt-2 break-all">
              <a href={result.claim_link} className="tnum underline">
                {result.claim_link}
              </a>
            </p>
          </div>
        ) : (
          <p className="border border-ink px-3 py-2">{t("signin.email_sent")}</p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      {error && (
        <p role="alert" className="border border-alert px-3 py-2 text-alert">
          {error}
        </p>
      )}
      <Field label={t("signin.email_label")} htmlFor="signin-email" required>
        <Input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@organisation.eu"
        />
      </Field>
      <Button type="submit" variant="primary" disabled={status === "working"} className="self-start">
        {mode === "on_screen" ? t("signin.button_reveal") : t("signin.button")}
      </Button>
    </form>
  )
}
