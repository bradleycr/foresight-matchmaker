import { getT } from "@/lib/i18n/server"
import { llmEnabled } from "@/lib/llm/client"
import { RegisterEntry } from "@/components/remmy/register-entry"

/**
 * "Add your profile" — traditional form, or Remmy chat when an LLM is configured.
 * Remmy only prepares drafts; the form submit remains the only publish path.
 */
export default async function RegisterPage() {
  const { t } = await getT()
  const remmy = llmEnabled()

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("register.title")}</h1>
      <p className="mt-2 max-w-2xl leading-relaxed">
        {remmy ? t("register.explainer_remmy") : t("register.explainer")}
      </p>
      <div className="mt-8">
        <RegisterEntry remmyEnabled={remmy} />
      </div>
    </div>
  )
}
