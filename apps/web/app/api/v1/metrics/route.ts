import { NextRequest, NextResponse } from "next/server"
import { forbidden } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { hydrateListings } from "@/lib/db/durable"
import { computeMetrics, metricsToCsv } from "@/lib/metrics"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/metrics — the full reporting payload, admin only.
 * `?format=csv` returns the flattened CSV export.
 */
export async function GET(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")

  await hydrateListings({ force: true })
  const metrics = computeMetrics()

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(metricsToCsv(metrics), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="matchmaker-metrics-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json(metrics)
}
