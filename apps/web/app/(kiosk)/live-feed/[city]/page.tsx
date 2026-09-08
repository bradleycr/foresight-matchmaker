import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getT } from "@/lib/i18n/server"
import { publicOrigin } from "@/lib/public-origin"
import { hydrateEvents, hydrateListings } from "@/lib/db/durable"
import { listEvents } from "@/lib/db/events"
import { listProfiles } from "@/lib/db/profiles"
import { isOnsiteCitySlug } from "@/lib/onsite/cities"
import { buildOnsiteFeed } from "@/lib/onsite/feed"
import { qrSvgMarkup } from "@/lib/onsite/qr"
import { LiveFeedScreen } from "@/components/onsite/live-feed-screen"
import { parseRehearseCount, rehearseOnsiteFeed } from "@/lib/onsite/rehearse"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Live feed",
  robots: { index: false, follow: false },
}

/**
 * Landscape room board. Open full-screen on the HDMI laptop.
 * QR on the right is /here/{city} — view profile, or sign in / create one.
 *
 * `?rehearse=2` fills the board locally / on preview deploys so the
 * first-arrivals layout can be judged before anyone checks in. Production
 * ignores it.
 */
export default async function LiveFeedCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>
  searchParams: Promise<{ rehearse?: string }>
}) {
  const { city: raw } = await params
  if (!isOnsiteCitySlug(raw)) notFound()

  const { t } = await getT()
  await Promise.all([hydrateListings(), hydrateEvents()])
  const { rehearse } = await searchParams
  const preview = parseRehearseCount(rehearse)
  const feed =
    preview == null
      ? buildOnsiteFeed(raw, listProfiles(), listEvents(), t)
      : rehearseOnsiteFeed(raw, preview, t)
  const joinUrl = `${publicOrigin()}/here/${raw}`

  return (
    <LiveFeedScreen
      city={raw}
      initial={feed}
      joinUrl={joinUrl}
      qrSvg={qrSvgMarkup(joinUrl)}
      profileOrigin={publicOrigin()}
      poll={preview == null}
    />
  )
}
