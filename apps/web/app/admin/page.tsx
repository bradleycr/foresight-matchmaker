import { apiFetch } from "@/lib/api/server-fetch"
import { isAdmin } from "@/lib/auth/admin"
import { hydrateListings } from "@/lib/db/durable"
import { collectSignupRows } from "@/lib/db/signups"
import { getT } from "@/lib/i18n/server"
import type { Metrics } from "@/lib/metrics"
import type { T } from "@/lib/i18n"
import { SignupList } from "@/components/admin/signup-list"

export const dynamic = "force-dynamic"

/**
 * /admin — reporting, gated by the demo password `password123` (and by
 * ADMIN_SECRET when that is also set). The form posts to /api/admin/login
 * so the signed cookie is set on a 303, not dropped by a Server Action
 * redirect.
 */

function CountTable({ title, data, t }: { title: string; data: Record<string, number>; t: T }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  return (
    <section className="border border-rule-strong">
      <h2 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
        {title}
      </h2>
      {entries.length === 0 ? (
        <p className="px-3 py-2 text-sm text-ink-soft">{t("admin.no_data")}</p>
      ) : (
        <table className="tnum w-full text-sm">
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key} className="border-b border-rule last:border-0">
                <td className="px-3 py-1">{key}</td>
                <td className="px-3 py-1 text-right font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Histogram({ title, data, t }: { title: string; data: Record<string, number>; t: T }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, v]) => v))
  return (
    <section className="border border-rule-strong">
      <h2 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
        {title}
      </h2>
      {entries.length === 0 ? (
        <p className="px-3 py-2 text-sm text-ink-soft">{t("admin.no_data")}</p>
      ) : (
        <ul className="px-3 py-2">
          {entries.map(([key, value]) => (
            <li key={key} className="mb-2">
              <div className="flex justify-between text-sm">
                <span>{key}</span>
                <span className="tnum font-semibold">{value}</span>
              </div>
              <div aria-hidden="true" className="mt-0.5 h-3 border border-ink">
                <div className="h-full bg-mark" style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; purged?: string; kept?: string }>
}) {
  const { t } = await getT()
  const { error, purged, kept } = await searchParams

  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("admin.title")}</h1>
        <form action="/api/admin/login" method="post" className="mt-6 flex flex-col gap-3">
          <label htmlFor="admin-secret" className="text-sm font-semibold uppercase tracking-wide">
            {t("admin.secret_label")}
          </label>
          <input
            id="admin-secret"
            name="secret"
            type="password"
            required
            className="min-h-11 border border-ink bg-paper px-3 py-2"
          />
          {error && (
            <p role="alert" className="border border-alert px-3 py-2 text-sm text-alert">
              {t("admin.bad_secret")}
            </p>
          )}
          <button
            type="submit"
            className="min-h-11 self-start border border-ink bg-mark px-4 font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
          >
            {t("admin.unlock")}
          </button>
        </form>
      </div>
    )
  }

  await hydrateListings({ force: true })
  const [metrics, signups] = await Promise.all([
    apiFetch("/api/v1/metrics").then((r) => r.json() as Promise<Metrics>),
    collectSignupRows(),
  ])
  const funnel = metrics.funnel

  return (
    <div className="py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("admin.title")}</h1>
        <a href="/api/v1/metrics?format=csv" className="border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper">
          {t("admin.export_csv")}
        </a>
      </div>

      {purged !== undefined ? (
        <p role="status" className="mt-4 border border-ink bg-paper-shade px-3 py-2">
          {t("admin.purge_synthetic_done", { removed: purged, kept: kept ?? "0" })}
        </p>
      ) : null}

      <SignupList signups={signups} t={t} />

      <section className="mt-6 border border-rule-strong p-4">
        <h2 className="font-listing text-base font-bold uppercase">{t("admin.purge_synthetic_title")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("admin.purge_synthetic_body")}</p>
        <form action="/api/admin/purge-synthetic" method="post" className="mt-3">
          <button
            type="submit"
            className="min-h-11 border border-alert px-4 text-sm font-semibold uppercase tracking-wide text-alert hover:bg-alert hover:text-paper"
          >
            {t("admin.purge_synthetic")}
          </button>
        </form>
      </section>

      {/* Headline figures. */}
      <dl className="mt-6 grid grid-cols-2 gap-px border border-rule-strong bg-rule-strong sm:grid-cols-4">
        {(
          [
            [t("admin.total_profiles"), metrics.profiles.total],
            [t("admin.median_completeness"), `${metrics.profiles.median_completeness}%`],
            [t("admin.intros_requested"), funnel.intros_requested],
            [
              t("admin.median_response"),
              metrics.median_response_hours === null ? "—" : `${metrics.median_response_hours.toFixed(1)} h`,
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-paper px-4 py-4">
            <dd className="tnum font-listing text-3xl font-bold">{value}</dd>
            <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      {/* Funnel: profiles → shortlists → intros → outcomes. */}
      <section className="mt-6 border border-rule-strong">
        <h2 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
          {t("admin.funnel")}
        </h2>
        <table className="tnum w-full text-sm">
          <tbody>
            {(
              [
                [t("admin.funnel_profiles"), funnel.profiles],
                [t("admin.funnel_shortlist"), funnel.profiles_with_shortlist_view],
                [t("admin.funnel_requested"), funnel.intros_requested],
                [t("admin.funnel_accepted"), funnel.intros_accepted],
                [t("admin.funnel_declined"), funnel.intros_declined],
                [t("admin.funnel_expired"), funnel.intros_expired],
              ] as const
            ).map(([label, value]) => (
              <tr key={label} className="border-b border-rule last:border-0">
                <td className="px-3 py-1">{label}</td>
                <td className="px-3 py-1 text-right font-semibold">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* The headline research output. */}
        <Histogram title={t("admin.blocker_histogram")} data={metrics.blocker_histogram} t={t} />
        <Histogram title={t("admin.empty_fields")} data={metrics.profiles.empty_field_counts} t={t} />
        <CountTable title={t("admin.by_kind")} data={metrics.profiles.by_kind} t={t} />
        <CountTable title={t("admin.by_country")} data={metrics.profiles.by_country} t={t} />
        <CountTable title={t("admin.by_org_type")} data={metrics.profiles.by_org_type} t={t} />
        <CountTable title={t("admin.per_week")} data={metrics.profiles.created_per_week} t={t} />
        <CountTable title={t("admin.decline_reasons")} data={metrics.decline_reasons} t={t} />
        <CountTable title={t("admin.joint_applications")} data={metrics.joint_applications} t={t} />
      </div>
    </div>
  )
}
