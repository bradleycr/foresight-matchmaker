import Link from "next/link"
import { getT } from "@/lib/i18n/server"

/** Inner 404 copy. Layouts that already wrap SiteChrome use this as-is. */
export async function NotFoundCopy() {
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
