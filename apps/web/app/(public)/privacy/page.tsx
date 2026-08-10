import { getT } from "@/lib/i18n/server"

/**
 * The privacy notice, mirrored from PRIVACY.md. Plain language for an
 * audience that includes hospital data-protection officers.
 */
export default async function PrivacyPage() {
  const { t } = await getT()

  const sections = [
    ["privacy.collected_title", "privacy.collected_body"],
    ["privacy.purpose_title", "privacy.purpose_body"],
    ["privacy.visibility_title", "privacy.visibility_body"],
    ["privacy.retention_title", "privacy.retention_body"],
    ["privacy.controller_title", "privacy.controller_body"],
    ["privacy.deletion_title", "privacy.deletion_body"],
  ] as const

  return (
    <article className="max-w-2xl py-8">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("privacy.title")}</h1>
      {sections.map(([titleKey, bodyKey]) => (
        <section key={titleKey} className="mt-6">
          <h2 className="border-b border-rule pb-1 font-listing text-xl font-bold uppercase">{t(titleKey)}</h2>
          <p className="mt-2 leading-relaxed">{t(bodyKey)}</p>
        </section>
      ))}
    </article>
  )
}
