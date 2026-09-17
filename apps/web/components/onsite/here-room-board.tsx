"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useT } from "@/lib/i18n/client"
import type { OnsiteCitySlug } from "@/lib/onsite/cities"
import type { OnsiteRoom } from "@/lib/onsite/types"
import { RoomPersonCard, type RoomCardLabels } from "./room-person-card"

/**
 * The phone board, shown inline the moment check-in lands.
 *
 * Two questions, two tabs: who here should I talk to, and who else is here.
 * It refreshes itself as people arrive, and never blanks out on a failed
 * poll — a stale room is far more useful than an empty one.
 */

const POLL_MS = 15_000

type Tab = "matches" | "everyone"

function tabClassName(active: boolean): string {
  return [
    "min-h-12 flex-1 border-2 px-3 text-xs font-semibold uppercase tracking-[0.12em]",
    active ? "border-ink bg-ink text-paper" : "border-ink bg-paper text-ink",
  ].join(" ")
}

export function HereRoomBoard({ city }: { city: OnsiteCitySlug }) {
  const t = useT()
  const [room, setRoom] = useState<OnsiteRoom | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>("matches")

  // The first payload decides which tab opens: pointing someone at an empty
  // shortlist when the room is full would be the wrong first impression.
  const tabChosen = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/onsite/room?city=${city}`, { cache: "no-store" })
      if (!res.ok) {
        setFailed(true)
        return
      }
      const next = (await res.json()) as OnsiteRoom
      setRoom(next)
      setFailed(false)
      if (!tabChosen.current) {
        tabChosen.current = true
        if (next.matches.length === 0 && next.everyone.length > 0) setTab("everyone")
      }
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)

    // Phones spend most of an evening in a pocket. Catch up on the way out
    // rather than showing whoever was in the room ten minutes ago.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  const labels: RoomCardLabels = {
    // Same label the projector uses, so wall and phone read as one system.
    seeking: t("field.looking_for"),
    strongOn: t("onsite.room.strong_on"),
    score: (score: number) => t("onsite.room.score_a11y", { n: score }),
  }

  if (!room) {
    return (
      <section className="mt-10 border-t border-rule pt-6">
        <p className="text-sm uppercase tracking-widest text-ink-soft" role="status">
          {failed ? t("onsite.room.error") : t("onsite.room.loading")}
        </p>
      </section>
    )
  }

  const people = tab === "matches" ? room.matches : room.everyone
  const empty = tab === "matches" ? t("onsite.room.matches_empty") : t("onsite.room.everyone_empty")

  return (
    <section className="mt-10 border-t border-rule pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-listing text-2xl uppercase leading-none tracking-tight">
          {t("onsite.room.title")}
        </h2>
        <p className="tnum shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {t("onsite.room.count", { n: room.count })}
        </p>
      </div>

      <div className="mt-4 flex gap-2" role="tablist" aria-label={t("onsite.room.title")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "matches"}
          className={tabClassName(tab === "matches")}
          onClick={() => setTab("matches")}
        >
          {t("onsite.room.tab_matches", { n: room.matches.length })}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "everyone"}
          className={tabClassName(tab === "everyone")}
          onClick={() => setTab("everyone")}
        >
          {t("onsite.room.tab_everyone", { n: room.everyone.length })}
        </button>
      </div>

      {people.length === 0 ? (
        <p className="mt-6 text-sm leading-relaxed text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {people.map((person) => (
            <RoomPersonCard key={person.id} person={person} labels={labels} />
          ))}
        </ul>
      )}

      <p className="mt-6 text-[11px] uppercase tracking-[0.14em] text-ink-soft" role="status">
        {failed ? t("onsite.room.stale") : t("onsite.room.live")}
      </p>
    </section>
  )
}
