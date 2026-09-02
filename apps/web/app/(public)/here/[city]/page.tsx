import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { peekLiveSession, RECONCILE_SESSION_PATH } from "@/lib/auth/live-session"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import { magicLinkMode } from "@/lib/auth/mail"
import { SigninForm } from "@/components/signin-form"
import { MagicLinkNote } from "@/components/magic-link-note"
import { HereRoomPanel } from "@/components/onsite/here-room-panel"
import { hydrateEvents } from "@/lib/db/durable"
import { listEvents } from "@/lib/db/events"
import { isOnsiteCitySlug } from "@/lib/onsite/cities"
import { isCheckedIn } from "@/lib/onsite/presence"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "I'm here",
  robots: { index: false, follow: false },
}

/**
 * Phone page behind the projector QR. Every path ends here: confirm email,
 * add a listing if needed, then join the room board automatically.
 */
export default async function HereCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: raw } = await params
  if (!isOnsiteCitySlug(raw)) notFound()

  const { t } = await getT()
  const next = `/here/${raw}`
  const live = await peekLiveSession()
  if (live?.needsReconcile) redirect(`${RECONCILE_SESSION_PATH}?next=${encodeURIComponent(next)}`)

  const session = live ? live.session : await getSession()

  let already = false
  if (live) {
    await hydrateEvents()
    already = isCheckedIn(listEvents(), raw, live.profile.id)
  }

  const registerHref = `/register?challenge=recoding_medicine&next=${encodeURIComponent(next)}`

  const mode = magicLinkMode()

  return (
    <div className="mx-auto max-w-md py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal">{t("onsite.feed.kicker")}</p>
      <h1 className="mt-2 font-listing text-5xl uppercase leading-none tracking-tight">
        {t(`onsite.city.${raw}`)}
      </h1>
      <p className="mt-2 text-sm uppercase tracking-widest text-ink-soft">{t(`onsite.date.${raw}`)}</p>

      {!session ? (
        <>
          <p className="mt-8 text-lg leading-relaxed">{t("onsite.here.signin_lead")}</p>
          <MagicLinkNote mode={mode} className="mt-4" />
          <div className="mt-6">
            <SigninForm mode={mode} next={next} intent="here" />
          </div>
        </>
      ) : !live ? (
        <>
          <p className="mt-8 text-lg leading-relaxed">{t("onsite.here.create_lead")}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t("onsite.here.create_body")}</p>
          <Link
            href={registerHref}
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center border border-ink bg-mark px-6 text-base font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
          >
            {t("onsite.here.cta_create")}
          </Link>
        </>
      ) : (
        <HereRoomPanel
          city={raw}
          orgName={live.profile.org_name}
          hidden={live.profile.visibility === "hidden"}
          already={already}
        />
      )}
    </div>
  )
}
