"use client"

import { useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import type { OnsiteCitySlug } from "@/lib/onsite/cities"

export function HereCheckIn({
  city,
  orgName,
  hidden,
  already,
}: {
  city: OnsiteCitySlug
  orgName: string
  hidden: boolean
  already: boolean
}) {
  const t = useT()
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(already ? "done" : "idle")

  async function checkIn() {
    setState("working")
    try {
      const res = await fetch("/api/v1/onsite/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      })
      if (!res.ok) {
        setState("error")
        return
      }
      setState("done")
    } catch {
      setState("error")
    }
  }

  return (
    <div className="mt-8">
      <p className="font-listing text-4xl uppercase leading-none tracking-tight">{orgName}</p>
      {hidden ? <p className="mt-4 text-sm text-ink-soft">{t("onsite.here.hidden")}</p> : null}
      {state === "done" ? (
        <p role="status" className="mt-6 text-lg">
          {t("onsite.here.checkedin")}
        </p>
      ) : (
        <Button
          type="button"
          variant="primary"
          className="mt-6 min-h-14 w-full text-base"
          disabled={state === "working"}
          onClick={() => void checkIn()}
        >
          {state === "working" ? t("onsite.here.working") : t("onsite.here.checkin")}
        </Button>
      )}
      {state === "error" ? (
        <p role="alert" className="mt-3 text-sm text-alert">
          {t("onsite.here.error")}
        </p>
      ) : null}
      <Link href="/me" className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold uppercase tracking-wide underline underline-offset-4">
        {t("onsite.here.view")}
      </Link>
    </div>
  )
}
