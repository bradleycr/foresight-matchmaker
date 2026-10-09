import { NextResponse } from "next/server"
import { cronAuthorized } from "@/lib/nudge/cron-auth"
import { syncResendListingNudges } from "@/lib/nudge/resend-sync"
import { runListingNudges } from "@/lib/nudge/run"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * GET /api/cron/listing-nudges
 *
 * Vercel Cron, daily. Bearer `CRON_SECRET`. Sends at most a handful of
 * week-later listing reminders for programmes with `autoNudge` on.
 */
export async function GET(req: Request): Promise<NextResponse> {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const sync = await syncResendListingNudges({ maxPages: 20 })
  const result = await runListingNudges()
  console.info("[nudge] listing drip", { sync, ...result })
  return NextResponse.json({ sync, ...result }, { headers: { "Cache-Control": "private, no-store" } })
}
