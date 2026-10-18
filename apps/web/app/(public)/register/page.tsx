import { redirect } from "next/navigation"
import { peekLiveSession, RECONCILE_SESSION_PATH } from "@/lib/auth/live-session"
import { getSession } from "@/lib/auth/session"
import { ensureOwnedListing } from "@/lib/db/durable"
import { getT } from "@/lib/i18n/server"
import { llmEnabled, llmReady } from "@/lib/llm/client"
import { magicLinkMode } from "@/lib/auth/mail"
import { RegisterEntry } from "@/components/remmy/register-entry"
import { SigninForm } from "@/components/signin-form"
import { DirectoryDisclaimer } from "@/components/directory-disclaimer"
import { MagicLinkNote } from "@/components/magic-link-note"
import { OneListingNote } from "@/components/one-listing-note"
import { challengeById, isApplicationChallenge } from "@/lib/challenges/catalog"
import {
  registerableChallengeIdOf,
  registerableChallengeIds,
  requestDemoUnlock,
} from "@/lib/challenges/visibility"
import { isHerePath, ownedListingRedirect, safeNextPath } from "@/lib/auth/next-path"
import Link from "next/link"

/**
 * Add a listing. Email must be confirmed first; then Remmy or the form.
 * People who already have a listing go to edit it.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; deleted?: string; next?: string }>
}) {
  const session = await getSession()
  // Verified mailboxes must see a durable listing if one exists — never the
  // create form for an email that already published on another isolate.
  if (session) {
    await ensureOwnedListing(session.profileId, session.email)
  }

  const live = await peekLiveSession()
  const { challenge, deleted, next: rawNext } = await searchParams
  const returnTo = ownedListingRedirect(rawNext)
  if (live) {
    redirect(
      live.needsReconcile ? `${RECONCILE_SESSION_PATH}?next=${encodeURIComponent(returnTo)}` : returnTo,
    )
  }

  const { t } = await getT()
  const unlock = await requestDemoUnlock()
  const defaultChallengeId = registerableChallengeIdOf(challenge, unlock)
  const challengeOptions = registerableChallengeIds(unlock)
  const afterCreateHref = isHerePath(safeNextPath(rawNext)) ? safeNextPath(rawNext)! : undefined
  const nextParams = new URLSearchParams()
  if (defaultChallengeId) nextParams.set("challenge", defaultChallengeId)
  if (afterCreateHref) nextParams.set("next", afterCreateHref)
  const nextQuery = nextParams.toString()
  const next = nextQuery ? `/register?${nextQuery}` : "/register"

  if (!defaultChallengeId || challengeOptions.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("register.title")}</h1>
        <p className="mt-4 leading-relaxed text-ink-soft">{t("register.no_open_programmes")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/#programmes"
            className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
          >
            {t("nav.programmes")}
          </Link>
          <Link
            href={session ? "/account" : "/signin?next=%2Faccount"}
            className="inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-teal hover:text-paper"
          >
            {t("nav.account")}
          </Link>
        </div>
      </div>
    )
  }

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
        {explainer ? <p className="mt-3 leading-relaxed">{explainer}</p> : null}
        <MagicLinkNote mode={mode} className={explainer ? "mt-4" : "mt-3"} />
        <SigninForm mode={mode} next={next} intent="signup" />
      </div>
    )
  }

  // Probe only when someone can actually open Remmy — not on the verify gate.
  const remmyConfigured = llmEnabled()
  const remmy = remmyConfigured ? await llmReady() : false
  const remmyMaintenance = remmyConfigured && !remmy

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("register.title")}</h1>
      {isApplicationChallenge(defaultChallengeId) ? (
        <DirectoryDisclaimer
          className="mt-6"
          applyHref={challengeById(defaultChallengeId).hostUrl}
          applyNote={t(`challenge.${defaultChallengeId}.host_note`)}
          applyLabel={t(`challenge.${defaultChallengeId}.host_link`)}
        />
      ) : (
        <DirectoryDisclaimer className="mt-6" />
      )}
      <OneListingNote className="mt-4" />
      {!remmy && !remmyMaintenance ? (
        <p className="mt-4 max-w-xl text-sm text-ink-soft">{t("register.explainer")}</p>
      ) : null}
      {remmyMaintenance ? (
        <p role="status" className="mt-4 max-w-xl border border-rule-strong bg-paper-shade px-3 py-2 text-sm leading-relaxed">
          {t("remmy.maintenance")}
        </p>
      ) : null}
      <p className="mt-4 max-w-xl text-sm text-ink-soft">
        {t("register.verified_as", { email: session.email })}
      </p>
      <div className="mt-8">
        <RegisterEntry
          remmyEnabled={remmy}
          defaultChallengeId={defaultChallengeId}
          visibleChallengeIds={challengeOptions}
          verifiedEmail={session.email}
          afterCreateHref={afterCreateHref}
        />
      </div>
    </div>
  )
}
