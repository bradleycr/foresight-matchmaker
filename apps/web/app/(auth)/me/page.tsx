import Link from "next/link"
import { redirect } from "next/navigation"
import type { Profile } from "@rmm/schema"
import { apiFetch } from "@/lib/api/server-fetch"
import { getSession } from "@/lib/auth/session"
import { peekLiveSession, RECONCILE_SESSION_PATH, redirectIfOwnListingGone } from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { llmEnabled } from "@/lib/llm/client"
import { MeEditor } from "@/components/remmy/me-editor"
import { OutcomeReport } from "@/components/outcome-report"
import { SignOutButton } from "@/components/sign-out-button"
import { DeleteAccountPanel } from "@/components/delete-account-panel"

export const dynamic = "force-dynamic"

const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "bradley@foresight.org"

/** Edit your own profile. The owner sees the full record, private fields included. */
export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string; created?: string }> }) {
  const live = await peekLiveSession()
  if (!live) {
    const session = await getSession()
    redirect(session ? "/register" : "/signin")
  }
  if (live.needsReconcile) redirect(`${RECONCILE_SESSION_PATH}?next=%2Fme`)

  const { t } = await getT()
  const { saved, created } = await searchParams

  const res = await apiFetch(`/api/v1/profiles/${live.profile.id}`)
  await redirectIfOwnListingGone(res)
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

      {created ? (
        <div role="status" className="mt-4 border border-ink bg-paper-shade px-3 py-3">
          <p>{t("me.created")}</p>
          <p className="mt-2 text-sm">
            <Link href="/me/matches" className="font-semibold underline underline-offset-2">
              {t("form.created_cta_matches")}
            </Link>
            {" · "}
            <Link href="/directory" className="font-semibold underline underline-offset-2">
              {t("nav.directory")}
            </Link>
          </p>
        </div>
      ) : null}

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
