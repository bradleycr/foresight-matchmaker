import type { Metrics } from "@/lib/metrics"
import type { T } from "@/lib/i18n"

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

/** Programme-scoped funnel and histograms. */
export function MetricsReport({ metrics, t }: { metrics: Metrics; t: T }) {
  const funnel = metrics.funnel
  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-px border border-rule-strong bg-rule-strong sm:grid-cols-4">
        {(
          [
            [t("admin.funnel_signups"), funnel.signups],
            [t("admin.funnel_unfinished"), funnel.unfinished],
            [t("admin.total_profiles"), metrics.profiles.total],
            [t("admin.intros_requested"), funnel.intros_requested],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-paper px-4 py-4">
            <dd className="tnum font-listing text-3xl font-bold">{value}</dd>
            <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
          </div>
        ))}
      </dl>

      <section className="mt-6 border border-rule-strong">
        <h2 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
          {t("admin.funnel")}
        </h2>
        <p className="border-b border-rule px-3 py-2 text-sm leading-relaxed text-ink-soft">{t("admin.funnel_hint")}</p>
        <table className="tnum w-full text-sm">
          <tbody>
            {(
              [
                [t("admin.funnel_signups"), funnel.signups],
                [t("admin.funnel_signed_in"), funnel.signed_in],
                [t("admin.funnel_unfinished_confirmed"), funnel.unfinished_confirmed],
                [t("admin.funnel_profiles"), funnel.profiles],
                [t("admin.funnel_shortlist"), funnel.profiles_with_shortlist_view],
                [t("admin.funnel_requested"), funnel.intros_requested],
                [t("admin.funnel_contact_email"), funnel.contact_email],
                [t("admin.funnel_contact_linkedin"), funnel.contact_linkedin],
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
        <Histogram title={t("admin.blocker_histogram")} data={metrics.blocker_histogram} t={t} />
        <Histogram title={t("admin.empty_fields")} data={metrics.profiles.empty_field_counts} t={t} />
        <CountTable title={t("admin.by_kind")} data={metrics.profiles.by_kind} t={t} />
        <CountTable title={t("admin.by_country")} data={metrics.profiles.by_country} t={t} />
        <CountTable title={t("admin.by_org_type")} data={metrics.profiles.by_org_type} t={t} />
        <CountTable title={t("admin.per_week")} data={metrics.profiles.created_per_week} t={t} />
        <CountTable title={t("admin.decline_reasons")} data={metrics.decline_reasons} t={t} />
        <CountTable title={t("admin.joint_applications")} data={metrics.joint_applications} t={t} />
      </div>
    </>
  )
}
