import type { SignupRow } from "@/lib/db/signups"
import type { T } from "@/lib/i18n"

/**
 * Contactable register of every email that requested a magic link.
 *
 * Aggregates elsewhere answer how the programme is doing; this answers who
 * to write to after a cold start wipes `/tmp`.
 */
export function SignupList({ signups, t }: { signups: SignupRow[]; t: T }) {
  return (
    <section aria-labelledby="admin-accounts" className="mt-6 border border-rule-strong">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-rule-strong bg-paper-shade px-3 py-2">
        <h2 id="admin-accounts" className="font-listing text-base font-bold uppercase">
          {t("admin.accounts_title")}
        </h2>
        <a
          href="/api/admin/signups?format=csv"
          className="border border-ink px-3 py-1.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {t("admin.accounts_export")}
        </a>
      </div>

      <p className="px-3 pt-3 text-sm leading-relaxed text-ink-soft">{t("admin.accounts_body")}</p>
      <p className="tnum px-3 pt-2 text-sm font-semibold uppercase tracking-wide">
        {t("admin.accounts_count", { n: signups.length })}
      </p>

      {signups.length === 0 ? (
        <p className="px-3 py-3 text-sm text-ink-soft">{t("admin.no_data")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-y border-rule bg-paper-shade text-left">
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_email")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_status")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_org")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_kind")}
                </th>
                <th scope="col" className="px-3 py-1.5 font-semibold uppercase tracking-wide">
                  {t("admin.accounts_created")}
                </th>
              </tr>
            </thead>
            <tbody>
              {signups.map((signup) => (
                <tr key={signup.contact_email} className="border-b border-rule last:border-0">
                  <td className="px-3 py-1.5">
                    <a href={`mailto:${signup.contact_email}`} className="underline underline-offset-2">
                      {signup.contact_email}
                    </a>
                  </td>
                  <td className="px-3 py-1.5">{t(`admin.status_${signup.status}`)}</td>
                  <td className="px-3 py-1.5">{signup.org_name || "—"}</td>
                  <td className="px-3 py-1.5">{signup.kind || "—"}</td>
                  <td className="tnum px-3 py-1.5 text-ink-soft">{signup.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
