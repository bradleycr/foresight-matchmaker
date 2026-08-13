"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"

export function ClaimForm({ token, next }: { token: string; next?: string }) {
  const t = useT()
  const router = useRouter()
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")
  const [error, setError] = useState("")

  async function claim() {
    setStatus("working")
    const res = await fetch("/api/v1/auth/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })

    if (res.ok) {
      router.push(next ?? "/me")
      router.refresh()
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? t("claim.error_generic"))
      setStatus("error")
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-3 border border-alert px-3 py-2 text-alert">
          {error}
        </p>
      )}
      <Button variant="primary" onClick={claim} disabled={status === "working"}>
        {t("claim.button")}
      </Button>
    </div>
  )
}
