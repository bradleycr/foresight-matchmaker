"use client"

import { useCallback, useRef, useState } from "react"
import { useT } from "@/lib/i18n/client"
import { ProfileForm, type ProfileFormHandle } from "@/components/profile-form"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { RemmyChat } from "./chat"
import { Button } from "@/components/ui/primitives"
import type { ChallengeId } from "@rmm/schema"

type Path = "choose" | "workspace"

/**
 * Register entry — choose Remmy or the form when an LLM is configured.
 * After chat, Fill form applies the draft immediately. Remmy stays mounted
 * so the person can keep talking or finish the highlighted fields by hand.
 */
export function RegisterEntry({
  remmyEnabled,
  defaultChallengeId,
}: {
  remmyEnabled: boolean
  defaultChallengeId?: ChallengeId
}) {
  const t = useT()
  const formRef = useRef<ProfileFormHandle>(null)
  const [path, setPath] = useState<Path>(remmyEnabled ? "choose" : "workspace")
  const [remmyStarted, setRemmyStarted] = useState(false)
  const [remmyOpen, setRemmyOpen] = useState(true)
  const [formVisible, setFormVisible] = useState(!remmyEnabled)
  const [seedProposal, setSeedProposal] = useState<PrefillProposal | null>(null)
  const [applied, setApplied] = useState(false)
  const [spotlightSeed, setSpotlightSeed] = useState(false)

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

  const getFormContext = useCallback(() => formRef.current?.getContext() ?? null, [])

  if (path === "choose" && remmyEnabled) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setRemmyStarted(true)
            setRemmyOpen(true)
            setPath("workspace")
          }}
          className="border-2 border-ink bg-paper p-5 text-left hover:bg-paper-shade"
        >
          <p className="inline-block bg-mark px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-mark-ink">
            {t("remmy.path_featured")}
          </p>
          <h2 className="mt-3 font-listing text-xl font-bold uppercase tracking-tight">{t("remmy.path_chat_title")}</h2>
          <p className="mt-2 text-sm leading-relaxed">{t("remmy.path_chat_body")}</p>
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide underline">{t("remmy.path_chat_cta")}</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setFormVisible(true)
            setRemmyStarted(false)
            setPath("workspace")
          }}
          className="border border-rule-strong bg-paper p-5 text-left hover:bg-paper-shade"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{t("remmy.path_classic")}</p>
          <h2 className="mt-3 font-listing text-xl font-bold uppercase tracking-tight">{t("remmy.path_form_title")}</h2>
          <p className="mt-2 text-sm leading-relaxed">{t("remmy.path_form_body")}</p>
          <p className="mt-4 text-sm font-semibold uppercase tracking-wide underline">{t("remmy.path_form_cta")}</p>
        </button>
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
          {!formVisible && <p className="text-sm text-ink-soft">{t("remmy.node_note")}</p>}
          <div hidden={formVisible && !remmyOpen}>
            <RemmyChat
              mode="create"
              compact={formVisible}
              formAlreadyOpen={formVisible}
              getFormContext={getFormContext}
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
          highlightGapsOnMount={spotlightSeed}
          defaultChallengeId={defaultChallengeId}
        />
      )}
    </div>
  )
}
