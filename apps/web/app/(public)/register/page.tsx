import { redirect } from "next/navigation"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { llmEnabled } from "@/lib/llm/client"
import { RegisterEntry } from "@/components/remmy/register-entry"
import { DirectoryDisclaimer } from "@/components/directory-disclaimer"
import { challengeIdOf } from "@/lib/challenges/catalog"

/**
 * "Add your profile" — traditional form, or Remmy chat when an LLM is configured.
 * Remmy only prepares drafts; the form submit remains the only publish path.
 * Signed-in owners already have a profile: send them to edit it.
 * Programme comes from ?challenge= when arriving from a programme page.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>
}) {
  const live = await peekLiveSession()
  if (live) redirect("/me")

  const { t } = await getT()
  const remmy = llmEnabled()
  const { challenge } = await searchParams
  const defaultChallengeId = challengeIdOf(challenge)

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("register.title")}</h1>
      <DirectoryDisclaimer className="mt-6" />
      {!remmy ? (
        <p className="mt-4 max-w-xl text-sm text-ink-soft">{t("register.explainer")}</p>
      ) : null}
      <div className="mt-8">
        <RegisterEntry remmyEnabled={remmy} defaultChallengeId={defaultChallengeId} />
      </div>
    </div>
  )
}
