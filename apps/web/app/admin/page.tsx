import Link from "next/link"
import { isAdmin } from "@/lib/auth/admin"
import { hydrateListings } from "@/lib/db/durable"
import { collectSignupRows } from "@/lib/db/signups"
import { getT } from "@/lib/i18n/server"
import { CHALLENGES } from "@/lib/challenges/catalog"
import { ProgrammeStatusTag } from "@/components/programme-status"
import { SignupList } from "@/components/admin/signup-list"
import { AdminLoginForm } from "@/components/admin/login-form"

export const dynamic = "force-dynamic"

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
  const signups = await collectSignupRows()

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("admin.title")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("admin.hub_body")}</p>

      <section className="mt-8 border border-rule-strong">
        <h2 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-base font-bold uppercase">
          {t("admin.programmes_title")}
        </h2>
        <ul>
          {CHALLENGES.map((challenge) => (
            <li key={challenge.id} className="border-b border-rule px-3 py-3 last:border-0">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-listing text-lg font-bold uppercase">
                {t(`challenge.${challenge.id}.name`)}
                <ProgrammeStatusTag challenge={challenge} t={t} />
              </p>
              <p className="mt-1 text-sm text-ink-soft">{t(`challenge.${challenge.id}.blurb`)}</p>
              <Link
                href={`/admin/${challenge.slug}`}
                className="mt-2 inline-block font-semibold underline underline-offset-2"
              >
                {t("admin.programme_report")}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <SignupList signups={signups} t={t} />
    </div>
  )
}
