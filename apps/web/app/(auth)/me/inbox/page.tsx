import { redirect } from "next/navigation"
import { apiFetch, redirectOnAuthFailure } from "@/lib/api/server-fetch"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import type { IntroPayload } from "@/lib/api/types"
import { InboxList } from "@/components/inbox-list"

export const dynamic = "force-dynamic"

/**
 * The contacts log: introductions emailed off-platform, with a record of
 * who you reached and who reached you. Continue the conversation in email.
 */
export default async function InboxPage() {
  const session = await getSession()
  if (!session) redirect("/signin")

  const { t } = await getT()
  const res = await apiFetch("/api/v1/intros")
  redirectOnAuthFailure(res)
  if (!res.ok) throw new Error(`Could not load your inbox (status ${res.status}).`)

  const { intros } = (await res.json()) as { intros: IntroPayload[] }

  return (
    <div className="py-6">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("inbox.title")}</h1>
      <InboxList intros={intros} />
    </div>
  )
}
