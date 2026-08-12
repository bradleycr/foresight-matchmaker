"use client"

import { useEffect, useRef, useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { proposalIsSubstantial, summaryFromProposal, transcriptFromMessages } from "@/lib/llm/proposal-utils"
import { RemmyDraftReview } from "./draft-review"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const LONG_PASTE_CHARS = 400

/**
 * Remmy chat — hybrid conversational intake:
 * 1. Remmy interviews (one question at a time).
 * 2. Schema extractor (/api/v1/prefill) maps the transcript → form fields.
 * 3. Human confirms the review card before the form is filled.
 */
export function RemmyChat({
  mode,
  currentProfile,
  onDraftConfirmed,
  onUseFormInstead,
}: {
  mode: "create" | "update"
  currentProfile?: Record<string, unknown> | null
  onDraftConfirmed: (proposal: PrefillProposal) => void
  onUseFormInstead: () => void
}) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{
    proposal: PrefillProposal
    summary: string[]
  } | null>(null)

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: mode === "update" ? t("remmy.hello_update") : t("remmy.hello_create"),
      },
    ])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [messages, pending, busy])

  const userTurns = messages.filter((m) => m.role === "user").length

  async function extractDraft(fromMessages: ChatMessage[], narrativeSummary: string[] = []) {
    const transcript = transcriptFromMessages(fromMessages)
    if (transcript.length < 40) return null

    const res = await fetch("/api/v1/prefill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcript }),
    })

    if (!res.ok) return null

    const body = (await res.json()) as { proposal: PrefillProposal }
    if (!proposalIsSubstantial(body.proposal)) return null

    return {
      proposal: body.proposal,
      summary: narrativeSummary.length > 0 ? narrativeSummary : summaryFromProposal(body.proposal),
    }
  }

  async function send(text: string, opts?: { bypassReviewLock?: boolean }) {
    const trimmed = text.trim()
    if (!trimmed || busy || (pending && !opts?.bypassReviewLock)) return

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }]
    setMessages(nextMessages)
    setInput("")
    setBusy(true)
    setError(null)

    const longPaste = trimmed.length >= LONG_PASTE_CHARS

    try {
      if (longPaste) {
        const draft = await extractDraft(nextMessages)
        if (draft) {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: t("remmy.paste_ready"),
            },
          ])
          setPending(draft)
          return
        }
      }

      const res = await fetch("/api/v1/remmy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: nextMessages,
          current_profile: mode === "update" ? currentProfile ?? null : null,
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
      }

      const withReply: ChatMessage[] = [...nextMessages, { role: "assistant", content: turn.reply }]
      setMessages(withReply)

      if (turn.ready_for_review) {
        const draft = await extractDraft(withReply, turn.draft_summary)
        if (draft) setPending(draft)
        else setError(t("remmy.fill_failed"))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("remmy.error"))
    } finally {
      setBusy(false)
    }
  }

  async function fillFormFromChat() {
    if (busy) return

    if (pending?.proposal) {
      onDraftConfirmed(pending.proposal)
      return
    }

    if (userTurns === 0) {
      onUseFormInstead()
      return
    }

    setBusy(true)
    setError(null)
    try {
      const draft = await extractDraft(messages)
      if (draft) {
        setPending(draft)
        return
      }
      setError(t("remmy.fill_failed"))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void send(input)
  }

  return (
    <div className="flex min-h-[32rem] flex-col border-2 border-ink bg-paper">
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
            {busy ? t("remmy.thinking") : t("remmy.fill_form")}
          </Button>
          <Button type="button" className="text-sm" disabled={busy} onClick={onUseFormInstead}>
            {t("remmy.blank_form")}
          </Button>
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
          </div>
        ))}

        {busy && (
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft" aria-live="polite">
            {t("remmy.thinking")}
          </p>
        )}

        {pending && (
          <RemmyDraftReview
            mode={mode}
            proposal={pending.proposal}
            summary={pending.summary}
            onConfirm={() => {
              onDraftConfirmed(pending.proposal)
              setPending(null)
            }}
            onRevise={() => {
              setPending(null)
              void send(t("remmy.revise_prompt"), { bypassReviewLock: true })
            }}
            onDiscard={() => {
              setPending(null)
              setMessages((m) => [...m, { role: "assistant", content: t("remmy.discarded") }])
            }}
          />
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
          rows={3}
          maxLength={4000}
          value={input}
          disabled={busy || Boolean(pending)}
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
          <Button type="submit" variant="primary" disabled={busy || Boolean(pending) || input.trim().length === 0}>
            {busy ? t("remmy.thinking") : t("remmy.send")}
          </Button>
        </div>
      </form>
    </div>
  )
}
