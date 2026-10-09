import Link from "next/link"
import { notFound } from "next/navigation"
import { buildProgrammeReport } from "@/lib/admin/report"
import { isAdmin } from "@/lib/auth/admin"
import { getT } from "@/lib/i18n/server"
import { challengeBySlug } from "@/lib/challenges/catalog"
import { SignupList } from "@/components/admin/signup-list"
import { AdminLoginForm } from "@/components/admin/login-form"
import { MetricsReport } from "@/components/admin/metrics-report"
import { AutoNudgeToggle } from "@/components/admin/auto-nudge-toggle"
import { NudgeBatchBar } from "@/components/admin/nudge-batch-bar"
import { OutreachPanel } from "@/components/admin/outreach-panel"
import { autoNudgeByProgramme } from "@/lib/nudge/settings"
import { loadOptOuts, loadSentKeys } from "@/lib/nudge/store"
import { syncResendListingNudges } from "@/lib/nudge/resend-sync"
import { durableEnabled } from "@/lib/db/durable-store"
import { mailConfigured } from "@/lib/auth/mail"

export const dynamic = "force-dynamic"

/**
 * /admin/{slug} — reporting for one programme. The app-wide desk is /admin.
 */
export default async function ProgrammeAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { slug } = await params
  const challenge = challengeBySlug(slug)
  if (!challenge) notFound()

  const { t } = await getT()
  const { error } = await searchParams
  const next = `/admin/${challenge.slug}`

  if (!(await isAdmin())) {
    return <AdminLoginForm next={next} error={error} t={t} />
  }

  const qs = new URLSearchParams({ challenge: challenge.id })
  await syncResendListingNudges()
  const [{ metrics, signups }, autoNudge, sentKeys, optedOut] = await Promise.all([
    buildProgrammeReport(challenge.id),
    autoNudgeByProgramme(),
    loadSentKeys(),
    loadOptOuts(),
  ])
  const remind = {
    challengeId: challenge.id,
    sentKeys: [...sentKeys],
    optedOut: [...optedOut],
    mailConfigured: mailConfigured(),
    durable: durableEnabled(),
  }

  return (
    <div className="py-6">
      <p className="text-sm font-semibold uppercase tracking-wide">
        <Link href="/admin" className="underline underline-offset-2">
          {t("admin.title")}
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">
          {t(`challenge.${challenge.id}.name`)}
        </h1>
        <a
          href={`/api/v1/metrics?${qs}&format=csv`}
          className="border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {t("admin.export_csv")}
        </a>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("admin.report_body")}</p>

      <section className="mt-8 border border-rule-strong">
        <h2 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
          {t("admin.nudge_title")}
        </h2>
        <div className="px-3 py-3">
          <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{t("admin.nudge_body")}</p>
          <div className="mt-4">
            <AutoNudgeToggle
              challengeId={challenge.id}
              programmeName={t(`challenge.${challenge.id}.name`)}
              enabled={autoNudge[challenge.id]}
              durable={remind.durable}
            />
          </div>
          <NudgeBatchBar
            challengeId={challenge.id}
            signups={signups}
            sentKeys={remind.sentKeys}
            optedOut={remind.optedOut}
            mailConfigured={remind.mailConfigured}
            durable={remind.durable}
          />
        </div>
      </section>

      <OutreachPanel signups={signups} sentKeys={remind.sentKeys} optedOut={remind.optedOut} />

      <SignupList signups={signups} t={t} exportHref={`/api/admin/signups?${qs}&format=csv`} remind={remind} />
      <MetricsReport metrics={metrics} t={t} />
    </div>
  )
}
