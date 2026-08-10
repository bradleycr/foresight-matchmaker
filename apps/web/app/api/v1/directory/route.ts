import { NextResponse } from "next/server"
import { listDirectoryProfiles } from "@/lib/db/profiles"
import { getSession } from "@/lib/auth/session"

/**
 * GET /api/v1/directory — the directory for the UI.
 *
 * Signed-in callers also receive `authenticated_only` profiles; anonymous
 * callers see `public` only. `hidden` never appears. Everything is redacted.
 *
 * The stable public machine contract for third parties is
 * `/api/v1/directory.json` (public profiles only).
 */
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  const profiles = listDirectoryProfiles({ includeAuthenticatedOnly: Boolean(session) })

  return NextResponse.json(
    { version: "v1", generated_at: new Date().toISOString(), profiles },
    {
      headers: {
        // Authenticated responses must not be shared caches.
        "Cache-Control": session ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300",
      },
    },
  )
}
