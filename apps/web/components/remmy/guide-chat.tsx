"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"
import type { GuidePart, GuideMatchCard } from "@/lib/remmy/hydrate-guide"
import { MatchShortlistPart, MatchDetailPart } from "./parts/match-parts"
import { IntroComposePart } from "./parts/intro-compose-part"
import { GapsPart, NavigatePart } from "./parts/gaps-part"

interface GuideTurn {
  role: "user" | "assistant"
  content: string
  parts?: GuidePart[]
}

const SUGGESTIONS = [
  "guide.suggest_matches",
  "guide.suggest_improve",
  "guide.suggest_connect",
] as const

/**
 * Logged-in Remmy: chat that emits curated generative UI parts
 * (shortlist, match detail, intro compose, gaps) instead of Markdown dumps.
 */
export function RemmyGuideChat() {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const [turns, setTurns] = useState<GuideTurn[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTurns([{ role: "assistant", content: t("guide.hello") }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [turns, busy])

  function attachIntro(match: GuideMatchCard) {
    const part: GuidePart = {
      type: "intro_compose",
      to_id: match.profile.id,
      to_name: match.profile.org_name,
      to_slug: match.profile.slug,
      draft_message: t("guide.default_intro", { name: match.profile.org_name }),
    }
    setTurns((prev) => [
      ...prev,
      {
        role: "assistant",
        content: t("guide.intro_prompt", { name: match.profile.org_name }),
        parts: [part],
      },
    ])
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
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: body.reply!, parts: body.parts ?? [] },
      ])
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
        <Link href="/me/matches?view=list" className="text-xs font-semibold uppercase tracking-wide underline">
          {t("guide.classic_list")}
        </Link>
      </header>

      <div ref={scroller} className="flex max-h-[min(70vh,36rem)] flex-col gap-4 overflow-y-auto px-3 py-4">
        {turns.map((turn, i) => (
          <div key={`${turn.role}-${i}`} className={turn.role === "user" ? "ml-6 sm:ml-16" : "mr-4 sm:mr-12"}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {turn.role === "user" ? t("remmy.you") : t("remmy.name")}
            </p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{turn.content}</p>
            {turn.parts?.map((part, j) => (
              <div key={`${part.type}-${j}`} className="mt-3">
                <GuidePartView part={part} onConnect={attachIntro} />
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
              className="border border-rule px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:border-ink hover:bg-paper-shade"
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
    </div>
  )
}

function GuidePartView({
  part,
  onConnect,
}: {
  part: GuidePart
  onConnect: (match: GuideMatchCard) => void
}) {
  switch (part.type) {
    case "match_shortlist":
      return <MatchShortlistPart matches={part.matches} onConnect={onConnect} />
    case "match_detail":
      return <MatchDetailPart match={part.match} onConnect={onConnect} />
    case "intro_compose":
      return (
        <IntroComposePart
          toId={part.to_id}
          toName={part.to_name}
          toSlug={part.to_slug}
          draftMessage={part.draft_message}
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
