import { redirect } from "next/navigation"
import { DEMO_EMAIL } from "@/lib/auth/demo"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { DemoLoginForm } from "@/components/demo/login-form"

export const dynamic = "force-dynamic"

/**
 * /demo — password gate into the foresight-bradley operator listing.
 * Already signed in as that account? Skip the form and go straight to /me.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { t } = await getT()
  const { error } = await searchParams
  const live = await peekLiveSession()

  if (live?.session.email.toLowerCase() === DEMO_EMAIL && live.profile) {
    redirect("/me")
  }

  return <DemoLoginForm error={error} t={t} />
}
