"use client"

import { useEffect, useRef, useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { EXAMPLE_AI_ABOUT } from "@/lib/llm/example-about"
import { RemmyDraftReview } from "./draft-review"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

/**
 * Remmy chat — create or update a profile by conversation.
 * Drafts require an explicit confirmation card before the parent applies them.
 * "Fill form from chat" always synthesises a proposal from the conversation
 * so answers are never dropped when leaving chat.
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
  /** Blank form — no chat transfer. */
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
  /** Best proposal seen this chat — even before ready_for_review. */
  const [latestProposal, setLatestProposal] = useState<{
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

  async function callRemmy(nextMessages: ChatMessage[], forceDraft = false) {
    const res = await fetch("/api/v1/remmy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        messages: nextMessages,
        current_profile: mode === "update" ? currentProfile ?? null : null,
        force_draft: forceDraft,
      }),
    })

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? t("remmy.error"))
    }

    return (await res.json()) as {
      reply: string
      ready_for_review: boolean
      draft_summary: string[]
      proposal: PrefillProposal | null
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

    try {
      const turn = await callRemmy(nextMessages)
      setMessages((m) => [...m, { role: "assistant", content: turn.reply }])

      if (turn.proposal) {
        const pack = { proposal: turn.proposal, summary: turn.draft_summary ?? [] }
        setLatestProposal(pack)
        if (turn.ready_for_review) setPending(pack)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("remmy.error"))
    } finally {
      setBusy(false)
    }
  }

  /**
   * Transfer chat → form. Uses the pending review draft, else the latest
   * proposal Remmy already returned, else forces a draft from the transcript.
   */
  async function fillFormFromChat() {
    if (busy) return

    if (pending?.proposal) {
      onDraftConfirmed(pending.proposal)
      return
    }
    if (latestProposal?.proposal) {
      onDraftConfirmed(latestProposal.proposal)
      return
    }
    if (userTurns === 0) {
      onUseFormInstead()
      return
    }

    setBusy(true)
    setError(null)
    try {
      const turn = await callRemmy(messages, true)
      setMessages((m) => [...m, { role: "assistant", content: turn.reply }])
      if (turn.proposal) {
        onDraftConfirmed(turn.proposal)
        return
      }
      setError(t("remmy.fill_failed"))
    } catch (e) {
      setError(e instanceof Error ? e.message : t("remmy.fill_failed"))
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
            disabled={busy}
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
              const draft = pending.proposal
              setPending(null)
              onDraftConfirmed(draft)
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
          <div className="flex flex-wrap gap-2">
            {mode === "create" && messages.length <= 2 && (
              <Button
                type="button"
                disabled={busy || Boolean(pending)}
                onClick={() => setInput(EXAMPLE_AI_ABOUT)}
              >
                {t("remmy.load_example")}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={busy || Boolean(pending) || input.trim().length === 0}>
              {busy ? t("remmy.thinking") : t("remmy.send")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
