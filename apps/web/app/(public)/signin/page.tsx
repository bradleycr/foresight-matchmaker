import { getT } from "@/lib/i18n/server"
import { magicLinkMode } from "@/lib/auth/mail"
import { SigninForm } from "@/components/signin-form"
import { MagicLinkNote } from "@/components/magic-link-note"
import { isBrowsePath, safeNextPath } from "@/lib/auth/next-path"

/**
 * Sign in by email. Copy matches the real delivery mode so we never promise
 * an email that will not be sent.
 */
export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; stale?: string }>
}) {
  const { t } = await getT()
  const mode = magicLinkMode()
  const { next: rawNext, stale } = await searchParams
  const next = safeNextPath(rawNext) ?? undefined
  const browsing = isBrowsePath(next ?? null)

  const explainer = browsing
    ? t("signin.browse_explainer")
    : mode === "email"
      ? null
      : mode === "on_screen"
        ? t("signin.explainer_on_screen")
        : t("signin.explainer_server_log")

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">
        {browsing ? t("signin.browse_title") : t("signin.title")}
      </h1>
      {stale && (
        <p role="status" className="mt-3 border border-ink bg-paper-shade px-3 py-2 text-sm">
          {t("signin.stale")}
        </p>
      )}
      {explainer ? <p className="mt-3 leading-relaxed">{explainer}</p> : null}
      <MagicLinkNote mode={mode} className={explainer ? "mt-4" : "mt-3"} />
      <SigninForm mode={mode} next={next} intent={browsing ? "browse" : "signin"} />
    </div>
  )
}
