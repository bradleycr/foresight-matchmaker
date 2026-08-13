"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { ProfileForm } from "@/components/profile-form"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { RemmyChat } from "./chat"
import type { ChallengeId } from "@rmm/schema"

type Path = "remmy" | "form"

/**
 * Register entry — form first; Remmy is optional when an LLM is configured.
 * Chat drafts only; the form submit remains the only publish path.
 */
export function RegisterEntry({
  remmyEnabled,
  defaultChallengeId,
}: {
  remmyEnabled: boolean
  defaultChallengeId?: ChallengeId
}) {
  const t = useT()
  const [path, setPath] = useState<Path>("form")
  const [confirmedDraft, setConfirmedDraft] = useState<PrefillProposal | null>(null)

  if (path === "remmy" && remmyEnabled && !confirmedDraft) {
    return (
      <RemmyChat
        mode="create"
        onDraftConfirmed={(proposal) => setConfirmedDraft(proposal)}
        onUseFormInstead={() => {
          setConfirmedDraft(null)
          setPath("form")
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {confirmedDraft && (
        <p role="status" className="border border-ink bg-paper-shade px-3 py-2 text-sm">
          {t("remmy.applied_to_form")}
        </p>
      )}
      {remmyEnabled && (
        <button
          type="button"
          className="text-sm font-semibold uppercase tracking-wide underline"
          onClick={() => {
            setConfirmedDraft(null)
            setPath("remmy")
          }}
        >
          {t("remmy.switch_to_chat")}
        </button>
      )}
      <ProfileForm
        prefillEnabled={remmyEnabled}
        initialProposal={confirmedDraft ?? undefined}
        highlightGapsOnMount={Boolean(confirmedDraft)}
        defaultChallengeId={defaultChallengeId}
      />
    </div>
  )
}
