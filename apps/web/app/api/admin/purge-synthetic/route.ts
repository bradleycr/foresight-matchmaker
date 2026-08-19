import { NextRequest, NextResponse } from "next/server"
import { forbidden } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { purgeSyntheticProfiles } from "@/lib/db/purge-core"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/purge-synthetic — drop fabricated seed listings.
 * Admin cookie required. Real registrations (anything not `.invalid`) stay.
 */
export async function POST(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")

  const { removed, kept } = purgeSyntheticProfiles()
  const dest = new URL("/admin", req.nextUrl.origin)
  dest.searchParams.set("purged", String(removed))
  dest.searchParams.set("kept", String(kept))
  return NextResponse.redirect(dest, 303)
}
