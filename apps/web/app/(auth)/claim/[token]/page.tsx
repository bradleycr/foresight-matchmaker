import { getT } from "@/lib/i18n/server"
import { ClaimForm } from "@/components/claim-form"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ token: string }> }

/**
 * The magic-link landing. The token is consumed only when the visitor
 * presses the button — a GET must never burn a single-use credential
 * (mail scanners prefetch links).
 */
export default async function ClaimPage({ params }: Params) {
  const { token } = await params
  const { t } = await getT()

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("claim.title")}</h1>
      <p className="mt-3 leading-relaxed">{t("claim.explainer")}</p>
      <ClaimForm token={token} />
    </div>
  )
}
