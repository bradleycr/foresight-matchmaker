"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { ProfileForm } from "@/components/profile-form"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { RemmyChat } from "./chat"

type Path = "choose" | "remmy" | "form"

/**
 * Register entry: traditional form, or Remmy — chat that only applies a
 * draft after the user confirms the review card.
 */
export function RegisterEntry({ remmyEnabled }: { remmyEnabled: boolean }) {
  const t = useT()
  const [path, setPath] = useState<Path>(remmyEnabled ? "choose" : "form")
  const [confirmedDraft, setConfirmedDraft] = useState<PrefillProposal | null>(null)

  if (path === "choose") {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => setPath("remmy")}
          className="group border-2 border-ink bg-mark p-6 text-left transition-colors hover:bg-ink hover:text-paper"
        >
          <p className="font-listing text-xs font-bold uppercase tracking-widest">{t("remmy.path_featured")}</p>
          <h2 className="mt-2 font-listing text-3xl font-bold uppercase tracking-tight">{t("remmy.path_chat_title")}</h2>
          <p className="mt-3 text-sm leading-relaxed opacity-90">{t("remmy.path_chat_body")}</p>
          <p className="mt-6 text-sm font-bold uppercase tracking-wide underline decoration-2 underline-offset-4">
            {t("remmy.path_chat_cta")}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setPath("form")}
          className="border-2 border-ink bg-paper p-6 text-left transition-colors hover:bg-paper-shade"
        >
          <p className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">{t("remmy.path_classic")}</p>
          <h2 className="mt-2 font-listing text-3xl font-bold uppercase tracking-tight">{t("remmy.path_form_title")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("remmy.path_form_body")}</p>
          <p className="mt-6 text-sm font-bold uppercase tracking-wide underline decoration-2 underline-offset-4">
            {t("remmy.path_form_cta")}
          </p>
        </button>
      </div>
    )
  }

  if (path === "remmy" && !confirmedDraft) {
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
      {remmyEnabled && path === "form" && (
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
      <ProfileForm prefillEnabled={remmyEnabled && !confirmedDraft} initialProposal={confirmedDraft ?? undefined} />
    </div>
  )
}
