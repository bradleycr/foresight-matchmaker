import { redirect } from "next/navigation"
import type { Profile } from "@rmm/schema"
import { apiFetch, redirectOnAuthFailure } from "@/lib/api/server-fetch"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import { llmEnabled } from "@/lib/llm/client"
import { MeEditor } from "@/components/remmy/me-editor"
import { OutcomeReport } from "@/components/outcome-report"
import { SignOutButton } from "@/components/sign-out-button"
import { DeleteAccountPanel } from "@/components/delete-account-panel"

export const dynamic = "force-dynamic"

const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "bradley@foresight.org"

/** Edit your own profile. The owner sees the full record, private fields included. */
export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const session = await getSession()
  if (!session) redirect("/signin")

  const { t } = await getT()
  const { saved } = await searchParams

  const res = await apiFetch(`/api/v1/profiles/${session.profileId}`)
  redirectOnAuthFailure(res)
  if (!res.ok) throw new Error(`Could not load your profile (status ${res.status}).`)
  const body = (await res.json()) as {
    profile: Profile
    joint_application?: "yes" | "no" | "not_yet" | null
  }
  const { profile } = body

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
      <OutcomeReport profileId={profile.id} initial={body.joint_application ?? null} />

      <div className="mt-8">
        <MeEditor profile={profile} remmyEnabled={llmEnabled()} />
      </div>

      <DeleteAccountPanel profileId={profile.id} orgName={profile.org_name} privacyEmail={PRIVACY_EMAIL} />
    </div>
  )
}
