import { getT } from "@/lib/i18n/server"
import { magicLinkMode } from "@/lib/auth/mail"
import { SigninForm } from "@/components/signin-form"

/**
 * Sign in by email. Copy matches the real delivery mode so we never promise
 * an email that will not be sent.
 */
export default async function SigninPage() {
  const { t } = await getT()
  const mode = magicLinkMode()

  const explainer =
    mode === "email"
      ? t("signin.explainer_email")
      : mode === "on_screen"
        ? t("signin.explainer_on_screen")
        : t("signin.explainer_server_log")

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("signin.title")}</h1>
      <p className="mt-3 leading-relaxed">{explainer}</p>
      <SigninForm mode={mode} />
    </div>
  )
}
