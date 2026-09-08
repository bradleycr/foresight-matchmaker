"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import { afterClaimHref } from "@/lib/auth/next-path"
import { DEFAULT_CONTACT_EMAIL } from "@/lib/contact"
import { FailureReportActions } from "@/components/bug-report"

export function ClaimForm({
  token,
  next,
  intent = "signin",
}: {
  token: string
  next?: string
  intent?: "signin" | "signup" | "here"
}) {
  const t = useT()
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")
  const [error, setError] = useState("")

  async function claim() {
    setStatus("working")
    setError("")

    let res: Response
    try {
      res = await fetch("/api/v1/auth/claim", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    } catch {
      // The token is single-use but unspent until the server sees it, so
      // retrying this same link is safe.
      setError(t("claim.error_network"))
      setStatus("error")
      return
    }

    if (res.ok) {
      const claimed = (await res.json().catch(() => null)) as { profile_id?: string | null } | null
      // Full document navigation so the browser commits Set-Cookie before
      // the next page reads it — client-side router.push can race Safari.
      window.location.assign(afterClaimHref(claimed?.profile_id ?? null, next))
      return
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? t("claim.error_generic"))
      setStatus("error")
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <div role="alert" className="mb-3 border border-alert px-3 py-2 text-alert">
          <p>{error}</p>
          <FailureReportActions email={DEFAULT_CONTACT_EMAIL} message={error} />
        </div>
      )}
      <Button type="button" variant="primary" onClick={claim} disabled={status === "working"}>
        {t(
          intent === "signup" ? "claim.button_signup" : intent === "here" ? "claim.button_here" : "claim.button",
        )}
      </Button>
    </div>
  )
}
