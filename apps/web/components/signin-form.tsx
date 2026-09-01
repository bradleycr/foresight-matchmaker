"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/client"
import { Button, Field, Input } from "@/components/ui/primitives"
import { afterClaimHref } from "@/lib/auth/next-path"
import type { DeliveryMode } from "@/lib/auth/mail"
import { DEFAULT_CONTACT_EMAIL } from "@/lib/contact"
import { FailureReportActions } from "@/components/bug-report"

type Result = { ok: true; mode: DeliveryMode; claim_link?: string }
type ClaimResult = { signed_in?: boolean; profile_id?: string | null }

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

export function SigninForm({
  mode,
  next,
  intent = "signin",
}: {
  mode: DeliveryMode
  next?: string
  intent?: "signin" | "signup" | "browse" | "here"
}) {
  const t = useT()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle")
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function claimAndEnter(link: string): Promise<boolean> {
    const token = tokenFromClaimLink(link)
    if (!token) return false
    let res: Response
    try {
      res = await fetch("/api/v1/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    } catch {
      return false
    }
    if (!res.ok) return false
    const claimed = (await res.json().catch(() => null)) as ClaimResult | null
    router.push(afterClaimHref(claimed?.profile_id ?? null, next))
    router.refresh()
    return true
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("working")
    setError(null)

    // Without this guard a dropped connection leaves the button stuck on
    // "Signing in…" with nothing to click — indistinguishable from a hang.
    let res: Response
    try {
      res = await fetch("/api/v1/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...(next ? { next } : {}) }),
      })
    } catch {
      setError(t("signin.error_network"))
      setStatus("error")
      return
    }

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

    const body = (await res.json().catch(() => null)) as Result | null
    if (!body) {
      setError(t("signin.error_generic"))
      setStatus("error")
      return
    }

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
    const titleKey =
      intent === "here"
        ? "onsite.here.verify_sent_title"
        : intent === "signup"
          ? "register.verify_sent_title"
          : intent === "browse"
            ? "signin.browse_sent_title"
            : "signin.email_sent_title"
    const bodyKey =
      intent === "here"
        ? "onsite.here.verify_sent"
        : intent === "signup"
          ? "register.verify_sent"
          : intent === "browse"
            ? "signin.browse_sent"
            : "signin.email_sent"
    return (
      <div className="mt-8 border-2 border-ink bg-paper-shade px-5 py-6">
        <p className="font-listing text-2xl font-bold uppercase tracking-tight">{t(titleKey)}</p>
        <p className="mt-3 leading-relaxed">{t(bodyKey)}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("auth.magic_link_after_send")}</p>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {error && (
          <div role="alert" className="border border-alert px-3 py-2 text-alert">
            <p>{error}</p>
            <FailureReportActions email={DEFAULT_CONTACT_EMAIL} message={error} />
          </div>
        )}
        <Field
          label={t(intent === "signup" ? "register.verify_email_label" : "signin.email_label")}
          htmlFor="signin-email"
          required
        >
          <Input
            id="signin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@organisation.eu"
          />
        </Field>
        <Button type="submit" variant="primary" disabled={status === "working"} className="self-start">
          {status === "working"
            ? t(
                intent === "here"
                  ? "onsite.here.verify_working"
                  : intent === "signup"
                    ? "register.verify_working"
                    : "signin.signing_in",
              )
            : intent === "here"
              ? mode === "on_screen"
                ? t("onsite.here.verify_button_reveal")
                : t("onsite.here.verify_button")
              : intent === "signup"
              ? mode === "on_screen"
                ? t("register.verify_button_reveal")
                : t("register.verify_button")
              : intent === "browse"
                ? t("signin.browse_button")
                : mode === "on_screen"
                  ? t("signin.button_reveal")
                  : t("signin.button")}
        </Button>
      </form>
      {/* Only before a link is requested — after "email sent", this CTA restarts
          verification on /register and feels like a loop. */}
      {intent !== "signup" ? (
        <p className="mt-6 text-sm text-ink-soft">
          {intent === "browse" ? t("signin.no_listing_hint") : t("signin.no_listing_yet")}{" "}
          <a href="/register" className="font-semibold underline underline-offset-2">
            {t("nav.register")}
          </a>
        </p>
      ) : null}
    </div>
  )
}
