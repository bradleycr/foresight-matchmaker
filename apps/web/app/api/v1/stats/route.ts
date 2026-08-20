import { NextResponse } from "next/server"
import { countVisibleProfilesByChallenge } from "@/lib/db/profiles"
import { hydrateListings } from "@/lib/db/durable"

/**
 * GET /api/v1/stats — public aggregates only. No organisation names.
 * Powers homepage / programme cards without opening the directory.
 */
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  await hydrateListings()
  return NextResponse.json(
    {
      version: "v1",
      generated_at: new Date().toISOString(),
      by_challenge: countVisibleProfilesByChallenge(),
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  )
}
