"use client"

import { useEffect, useRef, useState } from "react"
import type { Kind } from "@rmm/schema"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Button, Textarea } from "@/components/ui/primitives"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { fetchPrefill } from "@/lib/llm/fetch-prefill"
import { transcriptForExtraction } from "@/lib/llm/proposal-utils"
import { pasteLooksLikeUrlOnly } from "@/lib/paste-is-url"
import { ASK_CATALOG, activeChipTurn, answeredAsksFromMessages, gapsWithoutAnswered, isAskId, overlayAskOnProfile, proposalFromAsk, type AskId } from "@/lib/remmy/ask"
import { AskChipsPart } from "./parts/ask-chips"

export interface RemmyChatMessage {
  role: "user" | "assistant"
  content: string
  ask?: AskId
  askDone?: boolean
}

export interface RemmyFormContext {
  open_gaps: string[]
  current_profile: Record<string, unknown>
}

export interface RemmyApplyOpts {
  /** Highlight remaining gaps. Off for chip-by-chip fills. */
  spotlight?: boolean
}

const LONG_PASTE_CHARS = 400

function hydrateAsk(value: string | undefined): AskId | undefined {
  return isAskId(value) ? value : undefined
}

/**
 * Remmy chat — hybrid conversational intake:
 * 1. Remmy interviews (one question at a time).
 * 2. Vocabulary questions hydrate as tappable chips (generative UI).
 * 3. Schema extractor maps the transcript → form fields.
 * 4. Fill form (or a ready signal) applies the draft; chat stays available.
 *
 * When the form is on screen, only the current question stays open. The
 * rest of the transcript is a scrollable drawer — not a second page.
 */
export function RemmyChat({
  mode,
  currentProfile,
  getFormContext,
  formAlreadyOpen = false,
  compact = false,
  initialMessages,
  onMessagesChange,
  onDraftApplied,
  onUseFormInstead,
}: {
  mode: "create" | "update"
  currentProfile?: Record<string, unknown> | null
  getFormContext?: () => RemmyFormContext | null
  formAlreadyOpen?: boolean
  compact?: boolean
  initialMessages?: RemmyChatMessage[]
  onMessagesChange?: (messages: RemmyChatMessage[]) => void
  onDraftApplied: (proposal: PrefillProposal, opts?: RemmyApplyOpts) => void
  onUseFormInstead: () => void
}) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const answeredAsks = useRef<AskId[]>([])
  const profileOverlay = useRef<Record<string, unknown>>({})
  const restored = useRef(Boolean(initialMessages && initialMessages.length > 0))
  const onMessagesChangeRef = useRef(onMessagesChange)
  onMessagesChangeRef.current = onMessagesChange
  const [messages, setMessages] = useState<RemmyChatMessage[]>(() => {
    if (initialMessages && initialMessages.length > 0) {
      return initialMessages.map((m) => ({
        ...m,
        ask: hydrateAsk(m.ask),
      }))
    }
    return []
  })
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    if (restored.current) {
      answeredAsks.current = answeredAsksFromMessages(messages)
      return
    }
    answeredAsks.current = []
    profileOverlay.current = {}
    setMessages([
      {
        role: "assistant",
        content: mode === "update" ? t("remmy.hello_update") : t("remmy.hello_create"),
        ask: mode === "create" ? "kind" : undefined,
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    onMessagesChangeRef.current?.(messages)
  }, [messages])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [messages, busy])

  const userTurns = messages.filter((m) => m.role === "user").length

  async function extractDraft(fromMessages: RemmyChatMessage[]) {
    const transcript = transcriptForExtraction(fromMessages)
    if (transcript.length < 40) {
      return { ok: false as const, message: t("remmy.fill_failed") }
    }

    const result = await fetchPrefill(transcript, "chat")
    if (!result.ok) {
      return { ok: false as const, message: result.message }
    }

    return { ok: true as const, proposal: result.proposal }
  }

  function liveKind(): Kind | undefined {
    const fromOverlay = profileOverlay.current.kind
    if (typeof fromOverlay === "string") return fromOverlay as Kind
    const fromForm = getFormContext?.()?.current_profile.kind
    if (typeof fromForm === "string") return fromForm as Kind
    const fromProp = currentProfile?.kind
    if (typeof fromProp === "string") return fromProp as Kind
    return undefined
  }

  /** Form snapshot Remmy reads — includes chips that React has not painted yet. */
  function contextForTurn(transcript: RemmyChatMessage[] = messages) {
    const ctx = getFormContext?.() ?? null
    const answered = [...new Set([...answeredAsks.current, ...answeredAsksFromMessages(transcript)])]
    return {
      current_profile: {
        ...(ctx?.current_profile ?? (mode === "update" ? currentProfile ?? null : null) ?? {}),
        ...profileOverlay.current,
      },
      open_gaps: gapsWithoutAnswered(ctx?.open_gaps ?? [], answered),
      answered_asks: answered,
    }
  }

  function noteAnswered(ask: AskId, values?: string[]) {
    if (!answeredAsks.current.includes(ask)) answeredAsks.current = [...answeredAsks.current, ask]
    if (values) profileOverlay.current = overlayAskOnProfile(profileOverlay.current, ask, values)
  }

  function commitAsk(index: number, ask: AskId, values: string[]) {
    const catalog = ASK_CATALOG[ask]
    const labels = values.map((v) => enumLabel(t, catalog.group, v))
    const sentence = `${t(catalog.labelKey)}: ${labels.join(", ")}`
    const kind = ask === "kind" ? (values[0] as Kind) : liveKind()
    noteAnswered(ask, values)
    onDraftApplied(proposalFromAsk(ask, values, kind), { spotlight: false })
    const next = messages.map((msg, i) => (i === index ? { ...msg, askDone: true } : msg))
    setMessages(next)
    void send(sentence, next)
  }

  function skipAsk(index: number, ask: AskId) {
    const catalog = ASK_CATALOG[ask]
    const sentence = t(catalog.skipKey ?? "remmy.ask_skip_said")
    noteAnswered(ask)
    const next = messages.map((msg, i) => (i === index ? { ...msg, askDone: true } : msg))
    setMessages(next)
    void send(sentence, next)
  }

  async function send(text: string, fromMessages?: RemmyChatMessage[]) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    const nextMessages: RemmyChatMessage[] = [...(fromMessages ?? messages), { role: "user", content: trimmed }]
    setMessages(nextMessages)
    setInput("")
    setBusy(true)
    setError(null)

    const longPaste = trimmed.length >= LONG_PASTE_CHARS

    try {
      if (longPaste) {
        if (pasteLooksLikeUrlOnly(trimmed)) {
          setError(t("form.prefill_url_only"))
          return
        }
        const extracted = await extractDraft(nextMessages)
        if (extracted.ok) {
          setMessages((m) => [...m, { role: "assistant", content: t("remmy.paste_ready") }])
          onDraftApplied(extracted.proposal, { spotlight: true })
          return
        }
        setError(extracted.message)
        return
      }

      const ctx = contextForTurn(nextMessages)
      const res = await fetch("/api/v1/remmy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          current_profile: ctx.current_profile,
          open_gaps: ctx.open_gaps,
          answered_asks: ctx.answered_asks,
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? t("remmy.error"))
      }

      const turn = (await res.json()) as {
        reply: string
        ready_for_review: boolean
        draft_summary: string[]
        ask?: AskId | null
      }

      const ask =
        isAskId(turn.ask) && !ctx.answered_asks.includes(turn.ask) ? turn.ask : undefined

      const withReply: RemmyChatMessage[] = [
        ...nextMessages,
        { role: "assistant", content: turn.reply, ask },
      ]
      setMessages(withReply)

      if (turn.ready_for_review) {
        const extracted = await extractDraft(withReply)
        if (extracted.ok) onDraftApplied(extracted.proposal, { spotlight: true })
        else if (!formAlreadyOpen) setError(extracted.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("remmy.error"))
    } finally {
      setBusy(false)
    }
  }

  async function fillFormFromChat() {
    if (busy) return

    if (userTurns === 0) {
      onUseFormInstead()
      return
    }

    setBusy(true)
    setError(null)
    try {
      const extracted = await extractDraft(messages)
      if (extracted.ok) {
        onDraftApplied(extracted.proposal, { spotlight: true })
        return
      }
      setError(extracted.message)
    } finally {
      setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void send(input)
  }

  const chipTurn = activeChipTurn(messages)
  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant")
  const prior = lastAssistantIndex > 0 ? messages.slice(0, lastAssistantIndex) : []
  const live = lastAssistantIndex >= 0 ? messages.slice(lastAssistantIndex) : messages

  function bubble(m: RemmyChatMessage, i: number, showChips: boolean) {
    return (
      <div
        key={`${m.role}-${i}-${m.content.slice(0, 24)}`}
        className={
          m.role === "user"
            ? "ml-6 border border-ink bg-mark/40 px-3 py-2 text-sm leading-relaxed sm:ml-8"
            : "mr-2 border border-rule bg-paper-shade px-3 py-2 text-sm leading-relaxed sm:mr-4"
        }
      >
        <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
          {m.role === "user" ? t("remmy.you") : t("remmy.name")}
        </p>
        <p className="whitespace-pre-wrap">{m.content}</p>
        {showChips && m.ask && (
          <AskChipsPart
            key={`${i}-${m.ask}`}
            ask={m.ask}
            disabled={busy}
            onCommit={(values) => commitAsk(i, m.ask!, values)}
            onSkip={() => skipAsk(i, m.ask!)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col border-2 border-ink bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-paper-shade px-4 py-3">
        <div>
          <p className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">{t("remmy.kicker")}</p>
          <h2 className="font-listing text-xl font-bold uppercase tracking-tight sm:text-2xl">{t("remmy.name")}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {prior.length > 0 && (
            <Button
              type="button"
              className="text-sm"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((v) => !v)}
            >
              {historyOpen ? t("remmy.hide_history") : t("remmy.show_history")}
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            className="text-sm"
            disabled={busy || userTurns === 0}
            onClick={() => void fillFormFromChat()}
          >
            {busy ? t("remmy.thinking") : formAlreadyOpen ? t("remmy.fill_form_again") : t("remmy.fill_form")}
          </Button>
          {!formAlreadyOpen && (
            <Button type="button" className="text-sm" disabled={busy} onClick={onUseFormInstead}>
              {t("remmy.blank_form")}
            </Button>
          )}
        </div>
      </header>

      {historyOpen && prior.length > 0 && (
        <div
          ref={scroller}
          className="max-h-[min(20rem,45vh)] space-y-3 overflow-y-auto overscroll-contain border-b border-rule px-4 py-3"
        >
          {prior.map((m, i) => bubble(m, i, false))}
        </div>
      )}

      <div className="space-y-3 px-4 py-3">
        {live.map((m, offset) => {
          const i = lastAssistantIndex >= 0 ? lastAssistantIndex + offset : offset
          const showChips = chipTurn !== null && i === chipTurn.index && m.ask === chipTurn.ask && !m.askDone
          return bubble(m, i, showChips)
        })}
        {busy && (
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft" aria-live="polite">
            {t("remmy.thinking")}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="border-t-2 border-ink bg-paper-shade p-3">
        {error && (
          <p role="alert" className="mb-2 border border-alert px-2 py-1 text-sm text-alert">
            {error}
          </p>
        )}
        <label className="sr-only" htmlFor="remmy-input">
          {t("remmy.input_label")}
        </label>
        <Textarea
          id="remmy-input"
          rows={compact || formAlreadyOpen ? 2 : 3}
          maxLength={4000}
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("remmy.input_placeholder")}
          className="bg-paper"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-faint">{formAlreadyOpen ? t("remmy.draft_kept") : t("remmy.hint_verify")}</p>
          <Button type="submit" variant="primary" disabled={busy || input.trim().length === 0}>
            {busy ? t("remmy.thinking") : t("remmy.send")}
          </Button>
        </div>
      </form>
    </div>
  )
}
