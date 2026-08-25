import Link from "next/link"
import { getT } from "@/lib/i18n/server"
import { contactEmail } from "@/lib/contact"
import { BugReportMailto } from "./bug-report"
import { PartnerLogos } from "./partner-logos"
import { CHALLENGES, PLATFORM } from "@/lib/challenges/catalog"

/** Site colophon: Foresight operates the platform. */
export async function SiteFooter() {
  const { t } = await getT()
  const programme = CHALLENGES[0]
  const inbox = contactEmail()

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
          {programme ? (
            <p>
              <Link href={`/challenges/${programme.slug}`} className="font-semibold text-ink underline underline-offset-2">
                {t(`challenge.${programme.id}.name`)}
              </Link>
            </p>
          ) : null}
          <p className={programme ? "mt-2" : undefined}>{t("footer.deadline")}</p>
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
              <a href={`mailto:${inbox}`} className="underline underline-offset-2">
                {t("footer.privacy_contact")}
              </a>
              <span className="mt-0.5 block text-xs text-ink-faint">{inbox}</span>
            </li>
            <li id="beta" className="pt-2">
              <p className="font-semibold uppercase tracking-wide text-ink">{t("footer.beta_title")}</p>
              <p className="mt-1 leading-relaxed">{t("footer.beta_body")}</p>
              <BugReportMailto email={inbox} className="mt-1.5 inline-block font-semibold text-ink underline underline-offset-2">
                {t("footer.beta_report")}
              </BugReportMailto>
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
