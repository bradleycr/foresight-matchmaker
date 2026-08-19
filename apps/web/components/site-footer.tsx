import Link from "next/link"
import { getT } from "@/lib/i18n/server"
import { PartnerLogos } from "./partner-logos"
import { CHALLENGES, PLATFORM } from "@/lib/challenges/catalog"

const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "bradley@foresight.org"

/** Site colophon: Foresight operates the platform. */
export async function SiteFooter() {
  const { t } = await getT()
  const programme = CHALLENGES[0]

  return (
    <footer className="border-t-2 border-rule-strong py-8 text-sm text-ink-soft">
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.platform")}</h2>
          <p className="leading-relaxed">{t("footer.platform_body")}</p>
          <p className="mt-2">
            <a
              href={PLATFORM.operatorUrl}
              className="font-semibold text-ink underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              foresight.org
            </a>
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.challenge")}</h2>
          <p>{t("footer.deadline")}</p>
          {programme ? (
            <p className="mt-3">
              <a
                href={programme.hostUrl}
                className="font-semibold text-ink underline underline-offset-2"
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("footer.challenge_page")}
              </a>
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.legal")}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/privacy" className="font-semibold text-ink underline underline-offset-2">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <a href={`mailto:${PRIVACY_EMAIL}`} className="underline underline-offset-2">
                {t("footer.privacy_contact")}
              </a>
              <span className="mt-0.5 block text-xs text-ink-faint">{PRIVACY_EMAIL}</span>
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-8 max-w-3xl text-xs leading-relaxed">{t("footer.disclaimer")}</p>

      <div className="mt-5 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("footer.partners")}</p>
        <PartnerLogos />
      </div>
    </footer>
  )
}
