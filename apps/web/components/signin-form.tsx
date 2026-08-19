"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/client"
import { Button, Field, Input } from "@/components/ui/primitives"
import type { DeliveryMode } from "@/lib/auth/mail"

type Result = { ok: true; mode: DeliveryMode; claim_link?: string }

function tokenFromClaimLink(link: string): string | null {
  try {
    const path = new URL(link, "http://local").pathname
    const parts = path.split("/").filter(Boolean)
    const i = parts.indexOf("claim")
    const token = i >= 0 ? parts[i + 1] : null
    return token || null
  } catch {
    return null
  }
}

export function SigninForm({ mode, next }: { mode: DeliveryMode; next?: string }) {
  const t = useT()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle")
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function claimAndEnter(link: string): Promise<boolean> {
    const token = tokenFromClaimLink(link)
    if (!token) return false
    const res = await fetch("/api/v1/auth/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) return false
    router.push(next ?? "/me")
    router.refresh()
    return true
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("working")
    setError(null)

    const res = await fetch("/api/v1/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...(next ? { next } : {}) }),
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

    const body = (await res.json()) as Result

    // On-screen demo hosts: consume the token here so the person never
    // sees a raw URL or a second "confirm sign-in" page.
    if (body.claim_link) {
      const entered = await claimAndEnter(body.claim_link)
      if (entered) return
      setError(t("claim.error_generic"))
      setStatus("error")
      return
    }

    setResult(body)
    setStatus("done")
  }

  if (status === "done" && result) {
    return (
      <p className="mt-6 border border-ink px-3 py-2">{t("signin.email_sent")}</p>
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
        {status === "working"
          ? t("signin.signing_in")
          : mode === "on_screen"
            ? t("signin.button_reveal")
            : t("signin.button")}
      </Button>
    </form>
  )
}
