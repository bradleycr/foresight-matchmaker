import { getT } from "@/lib/i18n/server"
import { CHALLENGES } from "@/lib/challenges/catalog"

const PRIVACY_EMAIL = process.env.PRIVACY_CONTACT_EMAIL?.trim() || "bradley@foresight.org"
const UPDATED = "13 August 2026"

/**
 * Privacy notice for Foresight Matchmaking.
 * Written for organisation contacts and data-protection officers —
 * plain language, GDPR Art. 12–14 style transparency.
 */
export default async function PrivacyPage() {
  const { t } = await getT()
  const programme = CHALLENGES[0]

  const sections: Array<{ title: string; body: string }> = [
    { title: t("privacy.who_title"), body: t("privacy.who_body") },
    { title: t("privacy.collected_title"), body: t("privacy.collected_body") },
    { title: t("privacy.purpose_title"), body: t("privacy.purpose_body") },
    { title: t("privacy.legal_basis_title"), body: t("privacy.legal_basis_body") },
    { title: t("privacy.visibility_title"), body: t("privacy.visibility_body") },
    { title: t("privacy.recipients_title"), body: t("privacy.recipients_body") },
    { title: t("privacy.ai_title"), body: t("privacy.ai_body") },
    { title: t("privacy.cookies_title"), body: t("privacy.cookies_body") },
    { title: t("privacy.retention_title"), body: t("privacy.retention_body") },
    { title: t("privacy.rights_title"), body: t("privacy.rights_body") },
    { title: t("privacy.deletion_title"), body: t("privacy.deletion_body", { email: PRIVACY_EMAIL }) },
    { title: t("privacy.complaint_title"), body: t("privacy.complaint_body") },
  ]

  return (
    <article className="max-w-2xl py-8">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("privacy.title")}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t("privacy.updated", { date: UPDATED })}</p>
      <p className="mt-4 leading-relaxed text-ink-soft">{t("privacy.intro")}</p>

      {sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="border-b border-rule pb-1 font-listing text-xl font-bold uppercase">
            {section.title}
          </h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed">{section.body}</p>
        </section>
      ))}

      <section className="mt-8 border border-rule bg-paper-shade p-4">
        <h2 className="font-listing text-lg font-bold uppercase">{t("privacy.contact_box_title")}</h2>
        <p className="mt-2 leading-relaxed">
          {t("privacy.contact_box_body")}{" "}
          <a className="font-semibold underline" href={`mailto:${PRIVACY_EMAIL}`}>
            {PRIVACY_EMAIL}
          </a>
        </p>
        {programme ? (
          <p className="mt-2 text-sm text-ink-soft">
            {t("privacy.contact_challenge")}{" "}
            <a className="underline" href={`mailto:${programme.hostEmail}`}>
              {programme.hostEmail}
            </a>
          </p>
        ) : null}
      </section>
    </article>
  )
}
