import { NextRequest, NextResponse } from "next/server"
import { forbidden } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { hydrateListings } from "@/lib/db/durable"
import { collectSignupRows, signupsToCsv } from "@/lib/db/signups"

export const dynamic = "force-dynamic"

export type { SignupRow } from "@/lib/db/signups"

/**
 * GET /api/admin/signups — who has asked to sign in, admin only.
 *
 * Blob holds every requested email; SQLite listings (hydrated from Blob) fill
 * org fields. `?format=csv` is the copy that still works if the site is down.
 */
export async function GET(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")

  await hydrateListings({ force: true })
  const rows = await collectSignupRows()

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(signupsToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="matchmaker-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ count: rows.length, signups: rows })
}
