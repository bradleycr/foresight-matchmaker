import { redirect } from "next/navigation"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import { llmEnabled } from "@/lib/llm/client"
import { magicLinkMode } from "@/lib/auth/mail"
import { RegisterEntry } from "@/components/remmy/register-entry"
import { SigninForm } from "@/components/signin-form"
import { DirectoryDisclaimer } from "@/components/directory-disclaimer"
import { OneListingNote } from "@/components/one-listing-note"
import { challengeIdOf } from "@/lib/challenges/catalog"

/**
 * Add a listing. Email must be confirmed first; then Remmy or the form.
 * People who already have a listing go to edit it.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; deleted?: string }>
}) {
  const live = await peekLiveSession()
  if (live) redirect("/me")

  const session = await getSession()
  const { t } = await getT()
  const remmy = llmEnabled()
  const { challenge, deleted } = await searchParams
  const defaultChallengeId = challengeIdOf(challenge)
  const next = defaultChallengeId ? `/register?challenge=${defaultChallengeId}` : "/register"

  if (!session) {
    const mode = magicLinkMode()
    const explainer =
      mode === "email"
        ? t("register.verify_explainer_email")
        : mode === "on_screen"
          ? t("register.verify_explainer_on_screen")
          : t("register.verify_explainer_server_log")

    return (
      <div className="mx-auto max-w-md py-16">
        <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("register.title")}</h1>
        {deleted ? (
          <p role="status" className="mt-4 border border-ink bg-paper-shade px-3 py-2 text-sm leading-relaxed">
            {t("register.deleted")}
          </p>
        ) : null}
        <p className="mt-3 leading-relaxed">{explainer}</p>
        <OneListingNote className="mt-4" />
        <SigninForm mode={mode} next={next} intent="signup" />
      </div>
    )
  }

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("register.title")}</h1>
      <DirectoryDisclaimer className="mt-6" />
      <OneListingNote className="mt-4" />
      {!remmy ? (
        <p className="mt-4 max-w-xl text-sm text-ink-soft">{t("register.explainer")}</p>
      ) : null}
      <p className="mt-4 max-w-xl text-sm text-ink-soft">
        {t("register.verified_as", { email: session.email })}
      </p>
      <div className="mt-8">
        <RegisterEntry
          remmyEnabled={remmy}
          defaultChallengeId={defaultChallengeId}
          verifiedEmail={session.email}
        />
      </div>
    </div>
  )
}
