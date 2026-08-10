import { getT } from "@/lib/i18n/server"
import { llmEnabled } from "@/lib/llm/client"
import { ProfileForm } from "@/components/profile-form"

/**
 * "Add your profile" — the entry point for new organisations, open to the
 * public so the directory can grow live during the Aug 20 webinar.
 * The LLM pre-fill box appears only when the deployment has one configured.
 */
export default async function RegisterPage() {
  const { t } = await getT()

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("register.title")}</h1>
      <p className="mt-2 max-w-2xl leading-relaxed">{t("register.explainer")}</p>
      <div className="mt-8">
        <ProfileForm prefillEnabled={llmEnabled()} />
      </div>
    </div>
  )
}
