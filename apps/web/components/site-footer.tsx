import Link from "next/link"
import { getT } from "@/lib/i18n/server"
import { PartnerLogos } from "./partner-logos"

/** Directory back matter: hard facts, the public contract, and the small print. */
export async function SiteFooter() {
  const { t } = await getT()

  return (
    <footer className="border-t-2 border-rule-strong py-6 text-sm text-ink-soft">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.challenge")}</h2>
          <p>{t("footer.deadline")}</p>
          <p className="mt-1">{t("footer.webinar")}</p>
          <p className="mt-1">{t("footer.sprind")}</p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.contract")}</h2>
          <p>
            <a href="/api/v1/directory.json" className="underline">
              /api/v1/directory.json
            </a>
          </p>
          <p className="mt-1">
            <a href="/api/v1/schema" className="underline">
              /api/v1/schema
            </a>
          </p>
        </div>
        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.about")}</h2>
          <p>{t("footer.synthetic")}</p>
          <p className="mt-1">
            <Link href="/privacy" className="underline">
              {t("footer.privacy")}
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("footer.partners")}</p>
        <PartnerLogos />
      </div>
    </footer>
  )
}
