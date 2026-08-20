import { NextRequest, NextResponse } from "next/server"
import { forbidden, notFound } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { hydrateListings } from "@/lib/db/durable"
import { CHALLENGES } from "@/lib/challenges/catalog"
import { collectSignupRows, signupsToCsv } from "@/lib/db/signups"

export const dynamic = "force-dynamic"

export type { SignupRow } from "@/lib/db/signups"

/**
 * GET /api/admin/signups — who has asked to sign in, admin only.
 * `?challenge=` keeps listed rows for one programme.
 */
export async function GET(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")

  const raw = req.nextUrl.searchParams.get("challenge")
  const challenge = raw
    ? CHALLENGES.find((c) => c.id === raw || c.slug === raw)
    : undefined
  if (raw && !challenge) return notFound("Unknown programme.")

  await hydrateListings({ force: true })
  const rows = await collectSignupRows(challenge ? { challengeId: challenge.id } : undefined)
  const status = req.nextUrl.searchParams.get("status")
  const filtered = status === "unfinished" ? rows.filter((row) => row.status !== "listed") : rows

  const stamp = new Date().toISOString().slice(0, 10)
  const slug = challenge?.slug ?? "all"
  const suffix = status === "unfinished" ? "-unfinished" : ""

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(signupsToCsv(filtered), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="matchmaker-signups-${slug}${suffix}-${stamp}.csv"`,
      },
    })
  }

  return NextResponse.json({ count: filtered.length, signups: filtered })
}
