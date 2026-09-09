import { redirect } from "next/navigation"
import { DEMO_EMAIL } from "@/lib/auth/demo"
import { peekLiveSession } from "@/lib/auth/live-session"
import { getT } from "@/lib/i18n/server"
import { DemoLoginForm } from "@/components/demo/login-form"

export const dynamic = "force-dynamic"

/**
 * /demo — password gate into a listing without magic-link mail.
 * Default account is foresight-bradley; staff can pass any listed email
 * and check them into a room for the projector.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>
}) {
  const { t } = await getT()
  const { error, email } = await searchParams
  const live = await peekLiveSession()

  // Only skip the form when already on the default demo account with no
  // operator assist intent in the query string.
  if (!error && !email && live?.session.email.toLowerCase() === DEMO_EMAIL && live.profile) {
    redirect("/me")
  }

  return <DemoLoginForm error={error} email={email} t={t} />
}
