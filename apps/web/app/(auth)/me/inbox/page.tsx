import { redirect } from "next/navigation"
import { apiFetch } from "@/lib/api/server-fetch"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import type { IntroPayload } from "@/lib/api/types"
import { InboxList } from "@/components/inbox-list"

export const dynamic = "force-dynamic"

/**
 * The inbox: received introduction requests to answer, sent ones to track.
 * Contact details appear only on accepted intros — revealed to both sides
 * simultaneously, server-side.
 */
export default async function InboxPage() {
  const session = await getSession()
  if (!session) redirect("/signin")

  const { t } = await getT()
  const res = await apiFetch("/api/v1/intros")
  if (!res.ok) redirect("/signin")

  const { intros } = (await res.json()) as { intros: IntroPayload[] }

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("inbox.title")}</h1>
      <p className="mt-1 max-w-2xl text-ink-soft">{t("inbox.explainer")}</p>
      <InboxList intros={intros} />
    </div>
  )
}
