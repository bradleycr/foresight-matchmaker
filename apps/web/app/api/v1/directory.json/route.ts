import { NextResponse } from "next/server"
import { listDirectoryProfiles } from "@/lib/db/profiles"
import { getSession } from "@/lib/auth/session"
import { unauthorized } from "@/lib/api/respond"

/**
 * GET /api/v1/directory.json — members-only machine-readable listings.
 * Same corpus as `/api/v1/directory`. Contact details are never included.
 */
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return unauthorized("Sign in to browse the directory.")

  return NextResponse.json(
    {
      version: "v1",
      generated_at: new Date().toISOString(),
      profiles: listDirectoryProfiles({ includeAuthenticatedOnly: true }),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
