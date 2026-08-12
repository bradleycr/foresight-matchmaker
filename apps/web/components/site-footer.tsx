import Link from "next/link"
import { getT } from "@/lib/i18n/server"
import { PartnerLogos } from "./partner-logos"

const CHALLENGE_URL = "https://www.sprind.org/taten/challenges/recoding-medicine"
const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "bradley@foresight.org"

/** Site colophon: challenge facts, what this directory is, and legal links. */
export async function SiteFooter() {
  const { t } = await getT()

  return (
    <footer className="border-t-2 border-rule-strong py-8 text-sm text-ink-soft">
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.challenge")}</h2>
          <p>{t("footer.deadline")}</p>
          <p className="mt-1">{t("footer.webinar")}</p>
          <p className="mt-3">{t("footer.sprind")}</p>
          <p className="mt-3">
            <a
              href={CHALLENGE_URL}
              className="font-semibold text-ink underline underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("footer.challenge_page")}
            </a>
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold uppercase tracking-wide text-ink">{t("footer.directory")}</h2>
          <p className="leading-relaxed">{t("footer.directory_body")}</p>
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
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="underline underline-offset-2"
              >
                {t("footer.privacy_contact")}
              </a>
              <span className="mt-0.5 block text-xs text-ink-faint">{PRIVACY_EMAIL}</span>
            </li>
            <li>
              <a
                href="mailto:challenge@sprind.org"
                className="underline underline-offset-2"
              >
                {t("footer.challenge_contact")}
              </a>
              <span className="mt-0.5 block text-xs text-ink-faint">challenge@sprind.org</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink">{t("footer.partners")}</p>
        <PartnerLogos />
      </div>
    </footer>
  )
}
