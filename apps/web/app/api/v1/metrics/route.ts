import { NextRequest, NextResponse } from "next/server"
import { forbidden, notFound } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { buildProgrammeReport } from "@/lib/admin/report"
import { CHALLENGES } from "@/lib/challenges/catalog"
import { metricsToCsv } from "@/lib/metrics"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/metrics — admin reporting payload.
 * `?challenge=` scopes to one programme. `?format=csv` flattens the export.
 */
export async function GET(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")

  const raw = req.nextUrl.searchParams.get("challenge")
  const challenge = raw
    ? CHALLENGES.find((c) => c.id === raw || c.slug === raw)
    : undefined
  if (raw && !challenge) return notFound("Unknown programme.")

  const { metrics } = await buildProgrammeReport(challenge?.id)

  const stamp = new Date().toISOString().slice(0, 10)
  const slug = challenge?.slug ?? "all"

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(metricsToCsv(metrics), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="matchmaker-metrics-${slug}-${stamp}.csv"`,
      },
    })
  }

  return NextResponse.json(metrics)
}
