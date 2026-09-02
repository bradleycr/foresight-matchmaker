"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useT } from "@/lib/i18n/client"
import { ForesightMark } from "@/components/foresight-mark"
import { LiveFeedCountdown } from "@/components/onsite/live-feed-countdown"
import { LiveFeedPair } from "@/components/onsite/live-feed-pair"
import { LiveFeedPersonCard } from "@/components/onsite/live-feed-person-card"
import { LiveFeedQrRail } from "@/components/onsite/live-feed-qr-rail"
import type { OnsiteCitySlug } from "@/lib/onsite/cities"
import { KIND_LEGEND, KIND_SKIN } from "@/lib/onsite/kind-skin"
import { roomShape } from "@/lib/onsite/room-shape"
import type { OnsiteFeed } from "@/lib/onsite/types"

const POLL_MS = 8_000

/** Miniature cards, so the legend reads as the same object as the wall. */
function KindKey({ t }: { t: (key: string) => string }) {
  return (
    <ul className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
      {KIND_LEGEND.map((key) => (
        <li key={key} className="flex items-center gap-2">
          <span className={`h-3.5 w-6 border border-ink border-l-4 ${KIND_SKIN[key]}`} aria-hidden="true" />
          {t(`enum.kind.${key}`)}
        </li>
      ))}
    </ul>
  )
}

function RoomWall({
  people,
  lookingForLabel,
  profileOrigin,
  profileQrLabel,
}: {
  people: OnsiteFeed["people"]
  lookingForLabel: string
  profileOrigin: string
  profileQrLabel: string
}) {
  const { cols, rows } = roomShape(people.length)
  return (
    <ul
      className="grid h-full min-h-0 min-w-0 gap-2"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {people.map((person) => (
        <li key={person.id} className="min-h-0 min-w-0">
          <LiveFeedPersonCard
            {...person}
            tone="tile"
            lookingForLabel={lookingForLabel}
            profileOrigin={profileOrigin}
            profileQrLabel={profileQrLabel}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * One landscape HDMI frame. Title-safe padding lives on [data-kiosk] in
 * globals.css so TV overscan cannot eat the board. Nothing scrolls.
 */
export function LiveFeedScreen({
  city,
  initial,
  joinUrl,
  qrSvg,
  profileOrigin,
}: {
  city: OnsiteCitySlug
  initial: OnsiteFeed
  joinUrl: string
  qrSvg: string
  profileOrigin: string
}) {
  const t = useT()
  const [feed, setFeed] = useState(initial)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/onsite/feed?city=${city}`, { cache: "no-store" })
      if (!res.ok) return
      const next = (await res.json()) as OnsiteFeed
      if (alive.current) setFeed(next)
    } catch {
      // Keep the last good frame — the projector must not go blank.
    }
  }, [city])

  useEffect(() => {
    alive.current = true
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    return () => {
      alive.current = false
      window.clearInterval(id)
    }
  }, [refresh])

  const empty = feed.people.length === 0
  const solo = feed.people[0]
  const lookingForLabel = t("field.looking_for")
  const profileQrLabel = t("onsite.feed.profile_qr")
  const rest = feed.people.filter(
    (person) => person.id !== feed.spotlight?.left.id && person.id !== feed.spotlight?.right.id,
  )

  return (
    <div data-kiosk className="flex flex-col overflow-hidden bg-paper text-ink">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-2 border-ink bg-paper">
        <div className="brand-band h-1.5 w-full shrink-0" aria-hidden="true" />

        <header className="flex shrink-0 items-end justify-between gap-6 border-b-2 border-ink px-5 py-3 sm:gap-8 sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-end gap-4 sm:gap-5">
            <ForesightMark className="mb-0.5 h-6 sm:h-7" />
            <span aria-hidden="true" className="mb-0.5 hidden h-7 w-px shrink-0 bg-ink sm:block" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">{t("onsite.feed.kicker")}</p>
              <h1 className="mt-0.5 font-listing text-4xl uppercase leading-none tracking-tight sm:text-5xl">
                {feed.city_label}
              </h1>
              <p className="mt-1.5 text-xs uppercase tracking-[0.18em] text-ink-soft">{feed.date_label}</p>
            </div>
          </div>
          <div className="flex max-w-[46%] shrink-0 flex-col items-end gap-2 sm:gap-3">
            <p className="tnum font-listing text-4xl uppercase leading-none sm:text-5xl">
              {t("onsite.feed.here_count", { n: feed.count })}
            </p>
            <KindKey t={t} />
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 gap-4 px-4 py-4 sm:gap-5 sm:px-5 sm:py-4">
            {empty ? (
              <div className="flex h-full flex-col justify-center">
                <p className="max-w-3xl font-listing text-5xl uppercase leading-[0.92] tracking-tight sm:text-6xl">
                  {t("onsite.feed.empty")}
                </p>
              </div>
            ) : feed.spotlight ? (
              <>
                <LiveFeedPair
                  left={feed.spotlight.left}
                  right={feed.spotlight.right}
                  title={t("onsite.feed.spotlight")}
                  lookingForLabel={lookingForLabel}
                  profileOrigin={profileOrigin}
                  profileQrLabel={profileQrLabel}
                  countdown={
                    feed.spotlight.rotates ? (
                      <LiveFeedCountdown
                        label={(seconds) => t("onsite.feed.rotate_in", { n: seconds })}
                        onRotate={refresh}
                      />
                    ) : null
                  }
                />
                {rest.length > 0 ? (
                  <div className="min-h-0 min-w-0 flex-1">
                    <RoomWall
                      people={rest}
                      lookingForLabel={lookingForLabel}
                      profileOrigin={profileOrigin}
                      profileQrLabel={profileQrLabel}
                    />
                  </div>
                ) : null}
              </>
            ) : solo && feed.people.length === 1 ? (
              <div className="flex h-full w-full max-w-3xl items-stretch">
                <LiveFeedPersonCard
                  {...solo}
                  tone="hero"
                  lookingForLabel={lookingForLabel}
                  profileOrigin={profileOrigin}
                  profileQrLabel={profileQrLabel}
                />
              </div>
            ) : (
              <div className="min-h-0 min-w-0 flex-1">
                <RoomWall
                  people={feed.people}
                  lookingForLabel={lookingForLabel}
                  profileOrigin={profileOrigin}
                  profileQrLabel={profileQrLabel}
                />
              </div>
            )}
          </div>

          <LiveFeedQrRail
            qrSvg={qrSvg}
            joinUrl={joinUrl}
            scanLabel={t("onsite.feed.scan")}
            scanHint={t("onsite.feed.scan_hint")}
          />
        </div>
      </div>
    </div>
  )
}
