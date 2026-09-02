"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import type { OnsiteCitySlug } from "@/lib/onsite/cities"

type Phase = "joining" | "done" | "error"

/**
 * After email confirm, check in automatically and land on a clear success
 * screen — no extra tap, no accidental detour to matches.
 */
export function HereRoomPanel({
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
  const [phase, setPhase] = useState<Phase>(already ? "done" : "joining")
  const started = useRef(already)

  async function checkIn() {
    setPhase("joining")
    try {
      const res = await fetch("/api/v1/onsite/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      })
      if (!res.ok) {
        setPhase("error")
        return
      }
      setPhase("done")
    } catch {
      setPhase("error")
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      setPhase("joining")
      try {
        const res = await fetch("/api/v1/onsite/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city }),
        })
        if (!res.ok) {
          setPhase("error")
          return
        }
        setPhase("done")
      } catch {
        setPhase("error")
      }
    })()
  }, [city])

  if (phase === "joining") {
    return (
      <div className="mt-10">
        <p className="font-listing text-4xl uppercase leading-none tracking-tight">{orgName}</p>
        <p className="mt-6 text-lg text-ink-soft">{t("onsite.here.working")}</p>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="mt-10">
        <p className="font-listing text-4xl uppercase leading-none tracking-tight">{orgName}</p>
        <p role="alert" className="mt-6 text-sm text-alert">
          {t("onsite.here.error")}
        </p>
        <Button type="button" variant="primary" className="mt-6 min-h-14 w-full text-base" onClick={() => void checkIn()}>
          {t("onsite.here.retry")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-10">
      <h2 className="font-listing text-4xl uppercase leading-none tracking-tight">{t("onsite.here.done_title")}</h2>
      <p className="mt-4 text-lg leading-relaxed">
        {hidden ? t("onsite.here.done_hidden", { name: orgName }) : t("onsite.here.done_body", { name: orgName })}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/me/matches"
          className="inline-flex min-h-14 w-full items-center justify-center border border-ink bg-mark px-6 text-base font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("onsite.here.cta_matches")}
        </Link>
        <Link
          href="/me"
          className="inline-flex min-h-14 w-full items-center justify-center border border-ink bg-paper px-6 text-base font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {t("onsite.here.cta_profile")}
        </Link>
      </div>
    </div>
  )
}
