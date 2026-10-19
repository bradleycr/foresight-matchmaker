import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import {
  peekLiveSession,
  RECONCILE_SESSION_PATH,
} from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { llmEnabled, llmReady } from "@/lib/llm/client"
import { MeEditor } from "@/components/remmy/me-editor"
import Link from "next/link"
import { OutcomeReport } from "@/components/outcome-report"
import { SignOutButton } from "@/components/sign-out-button"
import { DeleteAccountPanel } from "@/components/delete-account-panel"
import { ProfileCompleteChoices } from "@/components/profile-complete-choices"
import { ProfileAvatar } from "@/components/nanowheel"
import { getJointApplicationOutcome } from "@/lib/db/profiles"

export const dynamic = "force-dynamic"

const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "bradley@foresight.org"

/** Edit your own profile. The owner sees the full record, private fields included. */
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; created?: string; outcome?: string }>
}) {
  const live = await peekLiveSession()
  if (!live) {
    const session = await getSession()
    if (!session) redirect("/signin")
    redirect("/register")
  }
  if (live.needsReconcile) redirect(`${RECONCILE_SESSION_PATH}?next=%2Fme`)

  const { t } = await getT()
  const { saved, created, outcome } = await searchParams
  const profile = live.profile
  const joint = getJointApplicationOutcome(profile.id) as "yes" | "no" | "not_yet" | null
  const remmyConfigured = llmEnabled()
  const remmy = remmyConfigured ? await llmReady() : false
  const highlightOutcome = outcome === "1"

  if (created) return <ProfileCompleteChoices profile={profile} t={t} />

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <ProfileAvatar name={profile.org_name} size="lg" className="mt-1" />
          <div className="min-w-0">
            <p className="font-listing text-sm font-bold uppercase tracking-widest text-teal">
              {t("me.kicker")}
            </p>
            <h1 className="mt-2 font-listing text-3xl font-bold uppercase tracking-tight">{t("me.title")}</h1>
            <p className="mt-1 text-ink-soft">
              {profile.org_name} · {t("me.completeness", { pct: profile.completeness })}
            </p>
            <p className="mt-2 max-w-xl text-sm text-ink-soft">
              {t("me.vs_account")}{" "}
              <Link href="/account" className="font-semibold text-ink underline underline-offset-2">
                {t("nav.account")}
              </Link>
            </p>
          </div>
        </div>
        <SignOutButton />
      </div>

      {saved && (
        <p role="status" className="mt-4 border border-ink bg-paper-shade px-3 py-2">
          {t("me.saved")}
        </p>
      )}

      {/* Records ask: connection / partner through the directory. */}
      <OutcomeReport profileId={profile.id} initial={joint} highlight={highlightOutcome} />

      <div className="mt-8">
        <MeEditor
          profile={profile}
          remmyEnabled={remmy}
          remmyMaintenance={remmyConfigured && !remmy}
        />
      </div>

      <DeleteAccountPanel profileId={profile.id} orgName={profile.org_name} privacyEmail={PRIVACY_EMAIL} />
    </div>
  )
}
