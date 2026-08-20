import Link from "next/link"
import { notFound } from "next/navigation"
import { apiFetch } from "@/lib/api/server-fetch"
import { isAdmin } from "@/lib/auth/admin"
import { hydrateListings, hydrateEvents } from "@/lib/db/durable"
import { collectSignupRows } from "@/lib/db/signups"
import { getT } from "@/lib/i18n/server"
import { challengeBySlug } from "@/lib/challenges/catalog"
import type { Metrics } from "@/lib/metrics"
import { SignupList } from "@/components/admin/signup-list"
import { AdminLoginForm } from "@/components/admin/login-form"
import { MetricsReport } from "@/components/admin/metrics-report"

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

  await hydrateListings({ force: true })
  await hydrateEvents({ force: true })
  const qs = new URLSearchParams({ challenge: challenge.id })
  const [metrics, signups] = await Promise.all([
    apiFetch(`/api/v1/metrics?${qs}`).then((r) => r.json() as Promise<Metrics>),
    collectSignupRows({ challengeId: challenge.id }),
  ])

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

      <SignupList signups={signups} t={t} exportHref={`/api/admin/signups?${qs}&format=csv`} />
      <MetricsReport metrics={metrics} t={t} />
    </div>
  )
}
