import Link from "next/link"
import { getT } from "@/lib/i18n/server"

/**
 * Renders for both `notFound()` calls (e.g. an unknown profile slug) and any
 * unmatched URL. Server Component — no client-side i18n plumbing needed.
 */
export default async function NotFound() {
  const { t } = await getT()

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("notfound.title")}</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{t("notfound.body")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
      >
        {t("notfound.back")}
      </Link>
    </div>
  )
}
