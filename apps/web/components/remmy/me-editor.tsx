"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import type { Profile } from "@rmm/schema"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import { ProfileForm, type ProfileFormHandle } from "@/components/profile-form"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { RemmyChat } from "./chat"

/**
 * Signed-in profile editor with an optional Remmy update path.
 * Drafts apply to the form immediately; Save on the form remains the write.
 * Matchmaking chat lives on /me/matches (generative UI).
 */
export function MeEditor({
  profile,
  remmyEnabled,
}: {
  profile: Profile
  remmyEnabled: boolean
}) {
  const t = useT()
  const formRef = useRef<ProfileFormHandle>(null)
  const [showRemmy, setShowRemmy] = useState(false)
  const [applied, setApplied] = useState(false)

  const applyFromRemmy = useCallback((proposal: PrefillProposal) => {
    setApplied(true)
    formRef.current?.applyDraft(proposal)
  }, [])

  const getFormContext = useCallback(
    () =>
      formRef.current?.getContext() ?? {
        open_gaps: [] as string[],
        current_profile: profile as unknown as Record<string, unknown>,
      },
    [profile],
  )

  return (
    <div className="space-y-4">
      {remmyEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-rule-strong bg-paper-shade px-4 py-3">
          <div>
            <p className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">{t("remmy.kicker")}</p>
            <p className="text-sm leading-relaxed">{t("remmy.me_teaser")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/me/matches"
              className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
            >
              {t("remmy.me_matches_cta")}
            </Link>
            <Button type="button" variant="outline" onClick={() => setShowRemmy((v) => !v)}>
              {showRemmy ? t("remmy.hide_chat") : t("remmy.me_show")}
            </Button>
          </div>
        </div>
      )}

      {showRemmy && remmyEnabled && (
        <RemmyChat
          mode="update"
          compact
          formAlreadyOpen
          currentProfile={profile as unknown as Record<string, unknown>}
          getFormContext={getFormContext}
          onDraftApplied={applyFromRemmy}
          onUseFormInstead={() => setShowRemmy(false)}
        />
      )}

      {applied && (
        <p role="status" className="border border-ink bg-paper-shade px-3 py-2 text-sm">
          {t("remmy.applied_to_form_update")}
        </p>
      )}

      <ProfileForm
        ref={formRef}
        initial={profile}
        profileId={profile.id}
        highlightGapsOnMount={false}
        prefillEnabled={false}
      />
    </div>
  )
}
