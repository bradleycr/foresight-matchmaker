"use client"

import { useEffect, useRef, useState } from "react"
import { CHALLENGE_ID, DEFAULT_CHALLENGE_ID, type ChallengeId, type Kind } from "@rmm/schema"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Button, Textarea } from "@/components/ui/primitives"
import { blankProposal, type PrefillProposal } from "@/lib/llm/prefill"
import { fetchPrefill } from "@/lib/llm/fetch-prefill"
import { fetchRemmyTurn } from "@/lib/llm/fetch-remmy"
import { transcriptForExtraction } from "@/lib/llm/proposal-utils"
import { websiteFromPaste } from "@/lib/paste-is-url"
import { essentialsReady, remmySprintGaps, type GapField } from "@/lib/profile-form-gaps"
import { ASK_CATALOG, activeChipTurn, answeredAsksFromMessages, gapsWithoutAnswered, isAskId, overlayAskOnProfile, proposalFromAsk, type AskId } from "@/lib/remmy/ask"
import { AskChipsPart } from "./parts/ask-chips"
import { ProfileReadyCard } from "./parts/ready-card"
import { cn } from "@/lib/utils"

export interface RemmyChatMessage {
  role: "user" | "assistant"
  content: string
  ask?: AskId
  askDone?: boolean
}

export interface RemmyFormContext {
  open_gaps: string[]
  required_gaps?: string[]
  optional_gaps?: string[]
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
 * The full transcript lives in one scrollable pane so people never wonder
 * whether they left the conversation.
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
  onReadyToPublish,
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
  onReadyToPublish?: () => void
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
  const [streamingReply, setStreamingReply] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [readyCopy, setReadyCopy] = useState<{ oneLiner?: string; summary?: string }>({})

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
  }, [messages, busy, streamingReply])

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

  function liveChallenge(): ChallengeId {
    const candidates = [profileOverlay.current.challenge_id, getFormContext?.()?.current_profile.challenge_id, currentProfile?.challenge_id]
    for (const value of candidates) {
      if (typeof value === "string" && CHALLENGE_ID.includes(value as ChallengeId)) return value as ChallengeId
    }
    return DEFAULT_CHALLENGE_ID
  }

  /** Form snapshot Remmy reads — includes chips that React has not painted yet. */
  function contextForTurn(transcript: RemmyChatMessage[] = messages) {
    const ctx = getFormContext?.() ?? null
    const answered = [...new Set([...answeredAsks.current, ...answeredAsksFromMessages(transcript)])]
    const required = ctx?.required_gaps ?? ctx?.open_gaps ?? []
    const optional = ctx?.optional_gaps ?? []
    return {
      current_profile: {
        ...(ctx?.current_profile ?? (mode === "update" ? currentProfile ?? null : null) ?? {}),
        ...profileOverlay.current,
      },
      open_gaps: gapsWithoutAnswered(required, answered),
      required_gaps: gapsWithoutAnswered(required, answered),
      optional_gaps: gapsWithoutAnswered(optional, answered),
      answered_asks: answered,
    }
  }

  function markReadyFromContext(proposal?: PrefillProposal) {
    if (mode !== "create") return
    const ctx = getFormContext?.()
    const required = (ctx?.required_gaps ?? ctx?.open_gaps ?? []) as GapField[]
    const profile = ctx?.current_profile ?? {}
    const name = (proposal?.org_name || profile.org_name || "").toString().trim()
    const one = (proposal?.one_liner || profile.one_liner || "").toString().trim()
    const kind = (proposal?.kind || profile.kind || "").toString()
    const holder = kind === "data_holder" || kind === "consortium"
    const rows = [
      ...(Array.isArray(profile.datasets) ? profile.datasets : []),
      ...(proposal?.datasets ?? []),
    ] as Array<{ name?: string; modality?: unknown[]; disease_area?: unknown[] }>
    const datasetOk =
      !holder ||
      rows.some((d) => Boolean(d.name?.trim() && d.modality?.length && d.disease_area?.length))
    const fromForm = essentialsReady(remmySprintGaps(required))
    if (fromForm || (name && one && datasetOk)) {
      setReady(true)
      setReadyCopy({
        oneLiner: proposal?.one_liner ?? (typeof profile.one_liner === "string" ? profile.one_liner : undefined),
        summary: proposal?.summary ?? (typeof profile.summary === "string" ? profile.summary : undefined),
      })
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

    const website = websiteFromPaste(trimmed)
    if (website) {
      try {
        onDraftApplied(blankProposal({ website }), { spotlight: false })
        setMessages([...nextMessages, { role: "assistant", content: t("remmy.url_saved") }])
      } finally {
        setBusy(false)
      }
      return
    }

    const longPaste = trimmed.length >= LONG_PASTE_CHARS

    try {
      if (longPaste) {
        const extracted = await extractDraft(nextMessages)
        if (extracted.ok) {
          setMessages((m) => [...m, { role: "assistant", content: t("remmy.paste_ready") }])
          onDraftApplied(extracted.proposal, { spotlight: true })
          markReadyFromContext(extracted.proposal)
          return
        }
        setError(extracted.message)
        return
      }

      const ctx = contextForTurn(nextMessages)
      const turn = await fetchRemmyTurn(
        {
          mode,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          current_profile: ctx.current_profile,
          open_gaps: ctx.open_gaps,
          required_gaps: ctx.required_gaps,
          optional_gaps: ctx.optional_gaps,
          answered_asks: ctx.answered_asks,
        },
        { onDelta: (reply) => setStreamingReply(reply) },
      )
      setStreamingReply(null)

      const ask =
        isAskId(turn.ask) && !ctx.answered_asks.includes(turn.ask) ? turn.ask : undefined

      const withReply: RemmyChatMessage[] = [
        ...nextMessages,
        { role: "assistant", content: turn.reply, ask },
      ]
      setMessages(withReply)

      if (turn.ready_for_review) {
        const extracted = await extractDraft(withReply)
        if (extracted.ok) {
          onDraftApplied(extracted.proposal, { spotlight: true })
          markReadyFromContext(extracted.proposal)
        } else if (!formAlreadyOpen) setError(extracted.message)
      }
    } catch (e) {
      setStreamingReply(null)
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
        markReadyFromContext(extracted.proposal)
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
            challengeId={liveChallenge()}
            disabled={busy}
            onCommit={(values) => commitAsk(i, m.ask!, values)}
            onSkip={() => skipAsk(i, m.ask!)}
          />
        )}
      </div>
    )
  }

  const fullscreen = !formAlreadyOpen && !compact

  return (
    <div
      className={cn(
        "flex flex-col border-2 border-ink bg-paper",
        fullscreen && "max-sm:fixed max-sm:inset-0 max-sm:z-30 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:border-0",
      )}
      aria-busy={busy}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-paper-shade px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <p className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">{t("remmy.kicker")}</p>
          <h2 className="font-listing text-xl font-bold uppercase tracking-tight sm:text-2xl">{t("remmy.name")}</h2>
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

      <div
        ref={scroller}
        className={cn(
          "space-y-3 overflow-y-auto overscroll-contain px-4 py-3",
          fullscreen ? "max-sm:min-h-0 max-sm:flex-1 sm:max-h-[min(32rem,60vh)]" : "max-h-[min(32rem,60vh)]",
        )}
      >
        {messages.map((m, i) => {
          const showChips = chipTurn !== null && i === chipTurn.index && m.ask === chipTurn.ask && !m.askDone
          return bubble(m, i, showChips)
        })}
        {busy && streamingReply ? (
          <div className="mr-2 border border-rule bg-paper-shade px-3 py-2 text-sm leading-relaxed sm:mr-4">
            <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">{t("remmy.name")}</p>
            <p className="whitespace-pre-wrap">{streamingReply}</p>
          </div>
        ) : null}
        {busy && !streamingReply && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 border border-ink bg-mark/40 px-3 py-3"
          >
            <span className="mt-1 inline-flex gap-1" aria-hidden="true">
              <span className="size-2 animate-pulse rounded-full bg-ink" />
              <span className="size-2 animate-pulse rounded-full bg-ink [animation-delay:150ms]" />
              <span className="size-2 animate-pulse rounded-full bg-ink [animation-delay:300ms]" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide">{t("remmy.thinking")}</p>
              <p className="mt-0.5 text-xs text-ink-soft">{t("remmy.thinking_hint")}</p>
            </div>
          </div>
        )}
        {ready && mode === "create" && !busy && onReadyToPublish ? (
          <ProfileReadyCard
            oneLiner={readyCopy.oneLiner}
            summary={readyCopy.summary}
            onPublish={() => onReadyToPublish?.()}
            onMore={() => setReady(false)}
          />
        ) : null}
      </div>

      <form onSubmit={submit} className="sticky bottom-0 border-t-2 border-ink bg-paper-shade p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
