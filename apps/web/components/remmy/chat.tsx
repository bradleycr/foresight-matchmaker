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
import { ASK_CATALOG, proposalFromAsk, type AskId } from "@/lib/remmy/ask"
import { AskChipsPart } from "./parts/ask-chips"
import { cn } from "@/lib/utils"

interface ChatMessage {
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

/**
 * Remmy chat — hybrid conversational intake:
 * 1. Remmy interviews (one question at a time).
 * 2. Vocabulary questions hydrate as tappable chips (generative UI).
 * 3. Schema extractor maps the transcript → form fields.
 * 4. Fill form (or a ready signal) applies the draft; chat stays available.
 */
export function RemmyChat({
  mode,
  currentProfile,
  getFormContext,
  formAlreadyOpen = false,
  compact = false,
  onDraftApplied,
  onUseFormInstead,
}: {
  mode: "create" | "update"
  currentProfile?: Record<string, unknown> | null
  getFormContext?: () => RemmyFormContext | null
  formAlreadyOpen?: boolean
  compact?: boolean
  onDraftApplied: (proposal: PrefillProposal, opts?: RemmyApplyOpts) => void
  onUseFormInstead: () => void
}) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [messages, busy])

  const userTurns = messages.filter((m) => m.role === "user").length

  async function extractDraft(fromMessages: ChatMessage[]) {
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
    const fromForm = getFormContext?.()?.current_profile.kind
    if (typeof fromForm === "string") return fromForm as Kind
    const fromProp = currentProfile?.kind
    if (typeof fromProp === "string") return fromProp as Kind
    return undefined
  }

  function commitAsk(index: number, ask: AskId, values: string[]) {
    const catalog = ASK_CATALOG[ask]
    const labels = values.map((v) => enumLabel(t, catalog.group, v))
    const sentence = `${t(catalog.labelKey)}: ${labels.join(", ")}`
    const kind = ask === "kind" ? (values[0] as Kind) : liveKind()
    onDraftApplied(proposalFromAsk(ask, values, kind), { spotlight: false })
    const next = messages.map((msg, i) => (i === index ? { ...msg, askDone: true } : msg))
    setMessages(next)
    void send(sentence, next)
  }

  function skipAsk(index: number) {
    const next = messages.map((msg, i) => (i === index ? { ...msg, askDone: true } : msg))
    setMessages(next)
    void send(t("remmy.ask_skip_said"), next)
  }

  async function send(text: string, fromMessages?: ChatMessage[]) {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    const nextMessages: ChatMessage[] = [...(fromMessages ?? messages), { role: "user", content: trimmed }]
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

      const ctx = getFormContext?.() ?? null
      const res = await fetch("/api/v1/remmy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          current_profile: ctx?.current_profile ?? (mode === "update" ? currentProfile ?? null : null),
          open_gaps: ctx?.open_gaps ?? [],
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

      const withReply: ChatMessage[] = [
        ...nextMessages,
        { role: "assistant", content: turn.reply, ask: turn.ask ?? undefined },
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

  const lastAskIndex = [...messages]
    .map((m, i) => ({ m, i }))
    .reverse()
    .find(({ m }) => m.role === "assistant" && m.ask && !m.askDone)?.i

  return (
    <div
      className={cn(
        "flex flex-col border-2 border-ink bg-paper",
        compact ? "min-h-[18rem]" : "min-h-[32rem]",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-paper-shade px-4 py-3">
        <div>
          <p className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">{t("remmy.kicker")}</p>
          <h2 className="font-listing text-2xl font-bold uppercase tracking-tight">{t("remmy.name")}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={
              m.role === "user"
                ? "ml-8 border border-ink bg-mark/40 px-3 py-2 text-sm leading-relaxed"
                : "mr-4 border border-rule bg-paper-shade px-3 py-2 text-sm leading-relaxed"
            }
          >
            <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
              {m.role === "user" ? t("remmy.you") : t("remmy.name")}
            </p>
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.role === "assistant" && m.ask && i === lastAskIndex && !m.askDone && (
              <AskChipsPart
                ask={m.ask}
                disabled={busy}
                onCommit={(values) => commitAsk(i, m.ask!, values)}
                onSkip={() => skipAsk(i)}
              />
            )}
          </div>
        ))}

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
          rows={compact ? 2 : 3}
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
          <p className="text-xs text-ink-faint">{t("remmy.hint_verify")}</p>
          <Button type="submit" variant="primary" disabled={busy || input.trim().length === 0}>
            {busy ? t("remmy.thinking") : t("remmy.send")}
          </Button>
        </div>
      </form>
    </div>
  )
}
