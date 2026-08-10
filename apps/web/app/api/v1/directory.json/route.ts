import { NextResponse } from "next/server"
import { listPublicProfiles } from "@/lib/db/profiles"

/**
 * GET /api/v1/directory.json — public profiles only (the machine-readable
 * contract). Does not include `authenticated_only` or `hidden`. For the
 * signed-in UI corpus, use `/api/v1/directory`.
 */
export const dynamic = "force-dynamic"

export function GET(): NextResponse {
  return NextResponse.json(
    { version: "v1", generated_at: new Date().toISOString(), profiles: listPublicProfiles() },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  )
}
