import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import {
  peekLiveSession,
  RECONCILE_SESSION_PATH,
} from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { llmEnabled } from "@/lib/llm/client"
import { MeEditor } from "@/components/remmy/me-editor"
import { OutcomeReport } from "@/components/outcome-report"
import { SignOutButton } from "@/components/sign-out-button"
import { DeleteAccountPanel } from "@/components/delete-account-panel"
import { ProfileCompleteChoices } from "@/components/profile-complete-choices"
import { getJointApplicationOutcome } from "@/lib/db/profiles"

export const dynamic = "force-dynamic"

const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "bradley@foresight.org"

/** Edit your own profile. The owner sees the full record, private fields included. */
export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string; created?: string }> }) {
  const live = await peekLiveSession()
  if (!live) {
    const session = await getSession()
    if (!session) redirect("/signin")
    redirect("/register")
  }
  if (live.needsReconcile) redirect(`${RECONCILE_SESSION_PATH}?next=%2Fme`)

  const { t } = await getT()
  const { saved, created } = await searchParams
  const profile = live.profile
  const joint = getJointApplicationOutcome(profile.id) as "yes" | "no" | "not_yet" | null

  if (created) return <ProfileCompleteChoices profile={profile} t={t} />

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("me.title")}</h1>
          <p className="mt-1 text-ink-soft">
            {profile.org_name} · {t("me.completeness", { pct: profile.completeness })}
          </p>
        </div>
        <SignOutButton />
      </div>

      {saved && (
        <p role="status" className="mt-4 border border-ink bg-paper-shade px-3 py-2">
          {t("me.saved")}
        </p>
      )}

      {/* The real KPI: did this directory lead to a joint application? */}
      <OutcomeReport profileId={profile.id} initial={joint} />

      <div className="mt-8">
        <MeEditor profile={profile} remmyEnabled={llmEnabled()} />
      </div>

      <DeleteAccountPanel profileId={profile.id} orgName={profile.org_name} privacyEmail={PRIVACY_EMAIL} />
    </div>
  )
}
