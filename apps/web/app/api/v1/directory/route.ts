import { NextResponse } from "next/server"
import { listDirectoryProfiles } from "@/lib/db/profiles"
import { getSession } from "@/lib/auth/session"
import { unauthorized } from "@/lib/api/respond"

/**
 * GET /api/v1/directory — members-only listings, redacted.
 * Hidden never appears. Authenticated-only listings are included.
 */
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to browse the directory.")

  const profiles = listDirectoryProfiles({ includeAuthenticatedOnly: true })

  return NextResponse.json(
    { version: "v1", generated_at: new Date().toISOString(), profiles },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
