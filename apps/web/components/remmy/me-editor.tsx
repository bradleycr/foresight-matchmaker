"use client"

import { useState } from "react"
import type { Profile } from "@rmm/schema"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import { ProfileForm } from "@/components/profile-form"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { RemmyChat } from "./chat"

/**
 * Signed-in profile editor with an optional Remmy update path.
 * Remmy drafts still require confirmation; Save on the form remains the write.
 */
export function MeEditor({
  profile,
  remmyEnabled,
}: {
  profile: Profile
  remmyEnabled: boolean
}) {
  const t = useT()
  const [showRemmy, setShowRemmy] = useState(false)
  const [proposal, setProposal] = useState<PrefillProposal | null>(null)
  const [formKey, setFormKey] = useState(0)

  return (
    <div className="space-y-4">
      {remmyEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-rule-strong bg-paper-shade px-4 py-3">
          <div>
            <p className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">{t("remmy.kicker")}</p>
            <p className="text-sm leading-relaxed">{t("remmy.me_teaser")}</p>
          </div>
          <Button type="button" variant={showRemmy ? "outline" : "primary"} onClick={() => setShowRemmy((v) => !v)}>
            {showRemmy ? t("remmy.me_hide") : t("remmy.me_show")}
          </Button>
        </div>
      )}

      {showRemmy && remmyEnabled && !proposal && (
        <RemmyChat
          mode="update"
          currentProfile={profile as unknown as Record<string, unknown>}
          onDraftConfirmed={(p) => {
            setProposal(p)
            setShowRemmy(false)
            setFormKey((k) => k + 1)
          }}
          onUseFormInstead={() => setShowRemmy(false)}
        />
      )}

      {proposal && (
        <p role="status" className="border border-ink bg-paper-shade px-3 py-2 text-sm">
          {t("remmy.applied_to_form_update")}
        </p>
      )}

      <ProfileForm
        key={formKey}
        initial={profile}
        profileId={profile.id}
        initialProposal={proposal ?? undefined}
        highlightGapsOnMount={Boolean(proposal)}
        prefillEnabled={false}
      />
    </div>
  )
}
