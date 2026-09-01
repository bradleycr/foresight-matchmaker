"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useT } from "@/lib/i18n/client"
import { ProfileForm, type ProfileFormHandle } from "@/components/profile-form"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { clearRegisterDraft, loadRegisterDraft, saveRegisterDraft, type RemmyDraftMessage } from "@/lib/register-draft"
import { isAskId } from "@/lib/remmy/ask"
import { RemmyChat, type RemmyChatMessage } from "./chat"
import { RemmyHostedNote } from "./hosted-note"
import { Button } from "@/components/ui/primitives"
import type { ChallengeId } from "@rmm/schema"

type Path = "choose" | "workspace"

function toChatMessages(rows: RemmyDraftMessage[]): RemmyChatMessage[] {
  return rows.map((m) => ({
    role: m.role,
    content: m.content,
    ask: isAskId(m.ask) ? m.ask : undefined,
    askDone: m.askDone,
  }))
}

/**
 * Register entry — two cards first (Remmy vs form). A saved draft never
 * skips that choice; people continue it from a quiet link under the cards.
 */
export function RegisterEntry({
  remmyEnabled,
  defaultChallengeId,
  verifiedEmail,
  afterCreateHref,
}: {
  remmyEnabled: boolean
  defaultChallengeId?: ChallengeId
  verifiedEmail: string
  afterCreateHref?: string
}) {
  const t = useT()
  const formRef = useRef<ProfileFormHandle>(null)
  const resume = useRef<{ remmyStarted: boolean; remmyOpen: boolean; formVisible: boolean } | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [path, setPath] = useState<Path>(remmyEnabled ? "choose" : "workspace")
  const [remmyStarted, setRemmyStarted] = useState(false)
  const [remmyOpen, setRemmyOpen] = useState(true)
  const [formVisible, setFormVisible] = useState(!remmyEnabled)
  const [seedProposal, setSeedProposal] = useState<PrefillProposal | null>(null)
  const [applied, setApplied] = useState(false)
  const [spotlightSeed, setSpotlightSeed] = useState(false)
  const [formSnapshot, setFormSnapshot] = useState<Record<string, unknown>>({})
  const [remmyMessages, setRemmyMessages] = useState<RemmyChatMessage[]>([])
  const [initialRemmy, setInitialRemmy] = useState<RemmyChatMessage[] | undefined>(undefined)
  const [initialForm, setInitialForm] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    const draft = loadRegisterDraft()
    if (draft) {
      resume.current = {
        remmyStarted: draft.remmyStarted,
        remmyOpen: draft.remmyOpen,
        formVisible: draft.formVisible,
      }
      setFormSnapshot(draft.form)
      setInitialForm(draft.form)
      const chat = toChatMessages(draft.remmyMessages)
      setRemmyMessages(chat)
      setInitialRemmy(chat.length > 0 ? chat : undefined)
      setHasDraft(true)
      if (draft.formVisible) setApplied(true)
    }
    if (!remmyEnabled) {
      setPath("workspace")
      setFormVisible(true)
    }
    setHydrated(true)
  }, [remmyEnabled])

  useEffect(() => {
    if (!hydrated) return
    const handle = window.setTimeout(() => {
      saveRegisterDraft({
        v: 1,
        savedAt: Date.now(),
        path,
        remmyStarted,
        remmyOpen,
        formVisible,
        form: formSnapshot,
        remmyMessages: remmyMessages.map(({ role, content, ask, askDone }) => ({
          role,
          content,
          ...(ask ? { ask } : {}),
          ...(askDone ? { askDone } : {}),
        })),
      })
    }, 400)
    return () => window.clearTimeout(handle)
  }, [hydrated, path, remmyStarted, remmyOpen, formVisible, formSnapshot, remmyMessages])

  const applyFromRemmy = useCallback((proposal: PrefillProposal, opts?: { spotlight?: boolean }) => {
    const spotlight = opts?.spotlight !== false
    if (spotlight) setApplied(true)
    if (formVisible && formRef.current) {
      formRef.current.applyDraft(proposal, { spotlight })
      return
    }
    setSeedProposal(proposal)
    setSpotlightSeed(spotlight)
    setFormVisible(true)
  }, [formVisible])

  const startRemmy = useCallback(() => {
    setRemmyStarted(true)
    setRemmyOpen(true)
    setFormVisible(false)
    setPath("workspace")
  }, [])

  const startForm = useCallback(() => {
    setFormVisible(true)
    setRemmyStarted(false)
    setRemmyOpen(false)
    setPath("workspace")
  }, [])

  const continueDraft = useCallback(() => {
    const saved = resume.current
    const formAlreadyOpen = saved?.formVisible === true
    setRemmyStarted(saved?.remmyStarted ?? true)
    setFormVisible(formAlreadyOpen)
    setRemmyOpen(formAlreadyOpen ? false : saved?.remmyOpen !== false)
    setPath("workspace")
  }, [])

  const getFormContext = useCallback(() => formRef.current?.getContext() ?? null, [])

  if (!hydrated) {
    return <p className="text-sm text-ink-soft">{t("remmy.draft_loading")}</p>
  }

  if (path === "choose" && remmyEnabled) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={startRemmy}
            className="border-2 border-ink bg-paper p-5 text-left hover:bg-paper-shade"
          >
            <p className="inline-block bg-mark px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-mark-ink">
              {t("remmy.path_featured")}
            </p>
            <h2 className="mt-3 font-listing text-xl font-bold uppercase tracking-tight">{t("remmy.path_chat_title")}</h2>
            <p className="mt-2 text-sm leading-relaxed">{t("remmy.path_chat_body")}</p>
            <RemmyHostedNote className="mt-3 text-ink-soft" />
            <p className="mt-4 text-sm font-semibold uppercase tracking-wide underline">{t("remmy.path_chat_cta")}</p>
          </button>
          <button
            type="button"
            onClick={startForm}
            className="border border-rule-strong bg-paper p-5 text-left hover:bg-paper-shade"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{t("remmy.path_classic")}</p>
            <h2 className="mt-3 font-listing text-xl font-bold uppercase tracking-tight">{t("remmy.path_form_title")}</h2>
            <p className="mt-2 text-sm leading-relaxed">{t("remmy.path_form_body")}</p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-wide underline">{t("remmy.path_form_cta")}</p>
          </button>
        </div>
        {hasDraft ? (
          <button
            type="button"
            onClick={continueDraft}
            className="text-sm font-semibold underline underline-offset-2"
          >
            {t("remmy.draft_continue")}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {remmyEnabled && remmyStarted && (
        <div className="space-y-3">
          {formVisible && (
            <div className="flex flex-col gap-3 border-2 border-ink bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-block bg-mark px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-mark-ink">
                  {t("remmy.name")}
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {applied ? t("remmy.applied_to_form") : t("remmy.form_and_chat_hint")}
                </p>
              </div>
              <Button
                type="button"
                variant={remmyOpen ? "outline" : "primary"}
                className="shrink-0 text-sm"
                aria-expanded={remmyOpen}
                onClick={() => setRemmyOpen((v) => !v)}
              >
                {remmyOpen ? t("remmy.hide_chat") : t("remmy.continue_chat")}
              </Button>
            </div>
          )}
          <div hidden={formVisible && !remmyOpen}>
            <RemmyChat
              mode="create"
              compact={formVisible}
              formAlreadyOpen={formVisible}
              getFormContext={getFormContext}
              initialMessages={initialRemmy}
              onMessagesChange={setRemmyMessages}
              onDraftApplied={applyFromRemmy}
              onUseFormInstead={() => {
                setFormVisible(true)
                setRemmyOpen(false)
              }}
            />
          </div>
        </div>
      )}

      {remmyEnabled && !remmyStarted && formVisible && (
        <button
          type="button"
          className="text-sm font-semibold uppercase tracking-wide underline"
          onClick={() => {
            setRemmyStarted(true)
            setRemmyOpen(true)
          }}
        >
          {t("remmy.continue_chat")}
        </button>
      )}

      {formVisible && (
        <ProfileForm
          ref={formRef}
          prefillEnabled={remmyEnabled && !remmyStarted}
          initialProposal={seedProposal ?? undefined}
          initialSnapshot={initialForm}
          highlightGapsOnMount={spotlightSeed}
          defaultChallengeId={defaultChallengeId}
          lockedEmail={verifiedEmail}
          onSnapshotChange={setFormSnapshot}
          onPublished={clearRegisterDraft}
          afterCreateHref={afterCreateHref}
        />
      )}
    </div>
  )
}
