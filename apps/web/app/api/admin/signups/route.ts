import { NextRequest, NextResponse } from "next/server"
import { forbidden } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { listProfiles } from "@/lib/db/profiles"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/signups — who has registered, admin only.
 *
 * Deliberately separate from the metrics export: metrics are aggregates for
 * reporting, this is the contactable list. If the live database is ever lost,
 * an operator needs addresses in hand to ask people to re-enter a profile, so
 * this stays a plain download rather than a dashboard-only view.
 *
 * `?format=csv` returns the spreadsheet form.
 */

export interface SignupRow {
  created_at: string
  contact_email: string
  contact_name: string
  contact_role: string
  org_name: string
  kind: string
  org_type: string
  country: string
  challenge_id: string
  completeness: number
  visibility: string
  website: string
}

const COLUMNS: readonly (keyof SignupRow)[] = [
  "created_at",
  "contact_email",
  "contact_name",
  "contact_role",
  "org_name",
  "kind",
  "org_type",
  "country",
  "challenge_id",
  "completeness",
  "visibility",
  "website",
]

function collectSignups(): SignupRow[] {
  return listProfiles()
    .map((profile) => ({
      created_at: profile.created_at,
      contact_email: profile.contact_email,
      contact_name: profile.contact_name ?? "",
      contact_role: profile.contact_role ?? "",
      org_name: profile.org_name,
      kind: profile.kind,
      org_type: profile.org_type,
      country: profile.country,
      challenge_id: profile.challenge_id ?? "recoding_medicine",
      completeness: profile.completeness,
      visibility: profile.visibility,
      website: profile.website ?? "",
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Quote only when the value would otherwise break the row. */
function csvCell(value: string | number): string {
  const text = String(value)
  return /["\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows: SignupRow[]): string {
  const lines = [COLUMNS.join(",")]
  for (const row of rows) {
    lines.push(COLUMNS.map((column) => csvCell(row[column])).join(","))
  }
  return lines.join("\n")
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")

  const rows = collectSignups()

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="matchmaker-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ count: rows.length, signups: rows })
}
