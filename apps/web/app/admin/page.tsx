import Link from "next/link"
import { isAdmin } from "@/lib/auth/admin"
import { hydrateListings } from "@/lib/db/durable"
import { collectSignupRows } from "@/lib/db/signups"
import { getT } from "@/lib/i18n/server"
import { visibleChallenges } from "@/lib/challenges/visibility"
import { ProgrammeStatusTag } from "@/components/programme-status"
import { SignupList } from "@/components/admin/signup-list"
import { AdminLoginForm } from "@/components/admin/login-form"
import { AutoNudgeToggle } from "@/components/admin/auto-nudge-toggle"
import { OutreachPanel } from "@/components/admin/outreach-panel"
import { autoNudgeByProgramme } from "@/lib/nudge/settings"
import { loadOptOuts, loadSentKeys } from "@/lib/nudge/store"
import { syncResendListingNudges } from "@/lib/nudge/resend-sync"
import { durableEnabled } from "@/lib/db/durable-store"
import { mailConfigured } from "@/lib/auth/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * /admin — operator desk for the whole app: accounts, and links into
 * each programme's report. Programme metrics live at /admin/{slug}.
 */
export default async function AdminHubPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { t } = await getT()
  const { error } = await searchParams

  if (!(await isAdmin())) {
    return <AdminLoginForm next="/admin" error={error} t={t} />
  }

  await hydrateListings()
  await syncResendListingNudges({ maxPages: 15 })
  // Hub lists only programmes this desk may show publicly — preview
  // programmes stay off so a Recoding Medicine screenshare never leaks ASB.
  const programmes = visibleChallenges(null)
  const [signups, autoNudge, sentKeys, optedOut] = await Promise.all([
    collectSignupRows(),
    autoNudgeByProgramme(),
    loadSentKeys(),
    loadOptOuts(),
  ])
  const remind = {
    sentKeys: [...sentKeys],
    optedOut: [...optedOut],
    mailConfigured: mailConfigured(),
    durable: durableEnabled(),
  }
  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("admin.title")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("admin.hub_body")}</p>

      <section className="mt-8 border border-rule-strong">
        <h2 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
          {t("admin.programmes_title")}
        </h2>
        <ul>
          {programmes.map((challenge) => (
            <li key={challenge.id} className="border-b border-rule px-3 py-3 last:border-0">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-listing text-lg font-bold uppercase">
                {t(`challenge.${challenge.id}.name`)}
                <ProgrammeStatusTag challenge={challenge} t={t} />
              </p>
              <p className="mt-1 text-sm text-ink-soft">{t(`challenge.${challenge.id}.blurb`)}</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <AutoNudgeToggle
                  challengeId={challenge.id}
                  programmeName={t(`challenge.${challenge.id}.name`)}
                  enabled={autoNudge[challenge.id]}
                  durable={remind.durable}
                />
                <Link
                  href={`/admin/${challenge.slug}`}
                  className="inline-block font-semibold underline underline-offset-2"
                >
                  {t("admin.programme_report")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <OutreachPanel signups={signups} sentKeys={remind.sentKeys} optedOut={remind.optedOut} />

      <SignupList signups={signups} t={t} remind={remind} />
    </div>
  )
}
