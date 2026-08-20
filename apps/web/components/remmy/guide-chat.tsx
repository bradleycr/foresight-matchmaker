"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"
import type { GuidePart, GuideMatchCard } from "@/lib/remmy/hydrate-guide"
import { MatchShortlistPart, MatchDetailChip, IntroDraftChip } from "./parts/match-parts"
import { MatchSheet } from "./parts/match-sheet"
import { GapsPart, NavigatePart } from "./parts/gaps-part"

interface GuideTurn {
  role: "user" | "assistant"
  content: string
  parts?: GuidePart[]
}

type SheetState =
  | { kind: "match"; match: GuideMatchCard; focus: "detail" | "intro" }
  | {
      kind: "intro"
      toName: string
      toSlug: string
      email?: string
      linkedin?: string
      open: boolean
    }

const SUGGESTIONS = [
  "guide.suggest_matches",
  "guide.suggest_improve",
  "guide.suggest_connect",
] as const

/**
 * Logged-in Remmy: chat that emits compact generative UI. Heavy surfaces
 * (match detail, intro compose) open as a sheet so the thread stays readable
 * on a phone.
 */
export function RemmyGuideChat({ embedded = false }: { embedded?: boolean }) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const [turns, setTurns] = useState<GuideTurn[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)

  useEffect(() => {
    setTurns([{ role: "assistant", content: t("guide.hello") }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [turns, busy])

  function openMatch(match: GuideMatchCard, intent: "detail" | "intro") {
    setSheet({ kind: "match", match, focus: intent })
  }

  function sheetFromParts(parts: GuidePart[]) {
    const detail = parts.find((p) => p.type === "match_detail")
    if (detail?.type === "match_detail") {
      setSheet({ kind: "match", match: detail.match, focus: "detail" })
      return
    }
    const intro = parts.find((p) => p.type === "intro_compose")
    if (intro?.type === "intro_compose") {
      setSheet({
        kind: "intro",
        toName: intro.to_name,
        toSlug: intro.to_slug,
        email: intro.contact_email,
        linkedin: intro.linkedin,
        open: intro.open_to_intros,
      })
    }
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    const nextTurns: GuideTurn[] = [...turns, { role: "user", content: trimmed }]
    setTurns(nextTurns)
    setInput("")
    setBusy(true)
    setError(null)

    try {
      const res = await fetch("/api/v1/remmy/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextTurns.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        reply?: string
        parts?: GuidePart[]
        error?: string
      }
      if (!res.ok || !body.reply) {
        setError(body.error ?? t("guide.error"))
        setBusy(false)
        return
      }
      const parts = body.parts ?? []
      setTurns((prev) => [...prev, { role: "assistant", content: body.reply!, parts }])
      sheetFromParts(parts)
    } catch {
      setError(t("guide.error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col border border-ink">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-paper-shade px-3 py-2">
        <div>
          <p className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">
            {t("remmy.kicker")}
          </p>
          <h2 className="font-listing text-lg font-bold uppercase leading-none">{t("guide.title")}</h2>
        </div>
        {!embedded ? (
          <Link href="/me/matches" className="text-xs font-semibold uppercase tracking-wide underline">
            {t("guide.classic_list")}
          </Link>
        ) : null}
      </header>

      <div
        ref={scroller}
        className="flex max-h-[min(65dvh,36rem)] flex-col gap-4 overflow-y-auto overscroll-contain px-3 py-4"
      >
        {turns.map((turn, i) => (
          <div key={`${turn.role}-${i}`}>
            <div className={turn.role === "user" ? "ml-8 sm:ml-16" : undefined}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {turn.role === "user" ? t("remmy.you") : t("remmy.name")}
              </p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">{turn.content}</p>
            </div>
            {turn.parts?.map((part, j) => (
              <div key={`${part.type}-${j}`} className="mt-3">
                <GuidePartView
                  part={part}
                  onOpenMatch={openMatch}
                  onOpenIntro={(intro) =>
                    setSheet({
                      kind: "intro",
                      toName: intro.to_name,
                      toSlug: intro.to_slug,
                      email: intro.contact_email,
                      linkedin: intro.linkedin,
                      open: intro.open_to_intros,
                    })
                  }
                />
              </div>
            ))}
          </div>
        ))}
        {busy ? <p className="text-sm text-ink-soft">{t("remmy.thinking")}</p> : null}
        {error ? (
          <p role="alert" className="border border-alert px-3 py-2 text-sm text-alert">
            {error}
          </p>
        ) : null}
      </div>

      {!busy && turns.length <= 2 ? (
        <div className="flex flex-wrap gap-2 border-t border-rule px-3 py-2">
          {SUGGESTIONS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => send(t(key))}
              className="min-h-11 border border-rule px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:border-ink hover:bg-paper-shade"
            >
              {t(key)}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="flex flex-col gap-2 border-t border-ink p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
      >
        <label className="sr-only" htmlFor="remmy-guide-input">
          {t("remmy.input_label")}
        </label>
        <Textarea
          id="remmy-guide-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("guide.input_placeholder")}
          disabled={busy}
        />
        <Button type="submit" variant="primary" disabled={busy || input.trim().length === 0} className="self-start">
          {t("remmy.send")}
        </Button>
      </form>

      {sheet?.kind === "match" ? (
        <MatchSheet
          match={sheet.match}
          intro={
            sheet.focus === "intro"
              ? {
                  toName: sheet.match.profile.org_name,
                  toSlug: sheet.match.profile.slug,
                  email: sheet.match.profile.contact_email,
                  linkedin: sheet.match.profile.linkedin,
                  open: sheet.match.profile.open_to_intros,
                }
              : undefined
          }
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === "intro" ? (
        <MatchSheet
          intro={{
            toName: sheet.toName,
            toSlug: sheet.toSlug,
            email: sheet.email,
            linkedin: sheet.linkedin,
            open: sheet.open,
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </div>
  )
}

function GuidePartView({
  part,
  onOpenMatch,
  onOpenIntro,
}: {
  part: GuidePart
  onOpenMatch: (match: GuideMatchCard, intent: "detail" | "intro") => void
  onOpenIntro: (intro: Extract<GuidePart, { type: "intro_compose" }>) => void
}) {
  switch (part.type) {
    case "match_shortlist":
      return <MatchShortlistPart matches={part.matches} onOpen={onOpenMatch} />
    case "match_detail":
      return <MatchDetailChip match={part.match} onOpen={onOpenMatch} />
    case "intro_compose":
      return (
        <IntroDraftChip
          name={part.to_name}
          onOpen={() => onOpenIntro(part)}
        />
      )
    case "gaps":
      return (
        <GapsPart
          nudgeKey={part.nudge_key}
          completeness={part.completeness}
          openToIntros={part.open_to_intros}
          matchCount={part.match_count}
        />
      )
    case "navigate":
      return <NavigatePart href={part.href} labelKey={part.label_key} />
    default:
      return null
  }
}
