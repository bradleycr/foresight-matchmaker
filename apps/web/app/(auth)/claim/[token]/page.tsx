import { getT } from "@/lib/i18n/server"
import { ClaimForm } from "@/components/claim-form"
import { isRegisterPath, isHerePath, hereCityFromPath, safeNextPath } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

/**
 * The magic-link landing. The token is consumed only when the visitor
 * presses the button — a GET must never burn a single-use credential
 * (mail scanners prefetch links).
 */
export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { token } = await params
  const { next: rawNext } = await searchParams
  const next = safeNextPath(rawNext) ?? undefined
  const signup = isRegisterPath(next ?? null)
  const here = isHerePath(next ?? null)
  const city = hereCityFromPath(next ?? null)
  const { t } = await getT()

  const titleKey = here
    ? "claim.title_here"
    : signup
      ? "claim.title_signup"
      : "claim.title"
  const explainerKey = here
    ? "claim.explainer_here"
    : signup
      ? "claim.explainer_signup"
      : "claim.explainer"
  const buttonIntent = here ? "here" : signup ? "signup" : "signin"

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t(titleKey)}</h1>
      <p className="mt-3 leading-relaxed">
        {here && city ? t(explainerKey, { city: t(`onsite.city.${city}`) }) : t(explainerKey)}
      </p>
      <ClaimForm token={token} next={next} intent={buttonIntent} />
    </div>
  )
}
