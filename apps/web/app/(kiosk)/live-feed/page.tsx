import { redirect } from "next/navigation"
import { liveFeedCity } from "@/lib/onsite/cities"

export const dynamic = "force-dynamic"

/** Projector entry — send the HDMI laptop to tonight's city. */
export default function LiveFeedIndexPage() {
  redirect(`/live-feed/${liveFeedCity()}`)
}
