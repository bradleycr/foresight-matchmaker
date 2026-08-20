import type { Profile } from "@rmm/schema"
import { listDurableSignups, type SignupRecord } from "./durable"
import { listProfiles } from "./profiles"

/**
 * The operator-facing register of every email that asked for a magic link,
 * confirmed it, or published a listing.
 *
 * Blob is the durable copy (Vercel `/tmp` SQLite is not). Hydrated listings
 * fill in org fields so people who listed before this register existed still
 * appear after a cold start.
 */

export type SignupStatus = "requested" | "confirmed" | "listed"

export interface SignupRow {
  created_at: string
  last_seen_at: string
  status: SignupStatus
  contact_email: string
  contact_name: string
  contact_role: string
  org_name: string
  kind: string
  org_type: string
  country: string
  challenge_id: string
  completeness: number | ""
  visibility: string
  website: string
}

export const SIGNUP_COLUMNS: readonly (keyof SignupRow)[] = [
  "created_at",
  "last_seen_at",
  "status",
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

function statusOf(row: {
  listed_at: string | null
  confirmed_at: string | null
  profile_id: string | null
}): SignupStatus {
  if (row.listed_at || row.profile_id) return "listed"
  if (row.confirmed_at) return "confirmed"
  return "requested"
}

function fromRecord(rec: SignupRecord): SignupRow {
  return {
    created_at: rec.first_seen_at,
    last_seen_at: rec.last_seen_at,
    status: statusOf(rec),
    contact_email: rec.email,
    contact_name: rec.contact_name ?? "",
    contact_role: rec.contact_role ?? "",
    org_name: rec.org_name ?? "",
    kind: rec.kind ?? "",
    org_type: rec.org_type ?? "",
    country: rec.country ?? "",
    challenge_id: rec.challenge_id ?? "",
    completeness: rec.completeness ?? "",
    visibility: rec.visibility ?? "",
    website: rec.website ?? "",
  }
}

function fromProfile(profile: Profile, previous?: SignupRecord): SignupRow {
  return {
    created_at: previous?.first_seen_at ?? profile.created_at,
    last_seen_at: previous?.last_seen_at ?? profile.updated_at ?? profile.created_at,
    status: "listed",
    contact_email: profile.contact_email.toLowerCase(),
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
  }
}

export async function collectSignupRows(): Promise<SignupRow[]> {
  const durable = await listDurableSignups()
  const byEmail = new Map<string, SignupRecord>()
  for (const rec of durable) byEmail.set(rec.email.toLowerCase(), rec)

  const rows = new Map<string, SignupRow>()
  for (const rec of durable) rows.set(rec.email.toLowerCase(), fromRecord(rec))

  for (const profile of listProfiles()) {
    const email = profile.contact_email.toLowerCase()
    rows.set(email, fromProfile(profile, byEmail.get(email)))
  }

  return [...rows.values()].sort(
    (a, b) => b.last_seen_at.localeCompare(a.last_seen_at) || b.created_at.localeCompare(a.created_at),
  )
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /["\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function signupsToCsv(rows: SignupRow[]): string {
  const lines = [SIGNUP_COLUMNS.join(",")]
  for (const row of rows) {
    lines.push(SIGNUP_COLUMNS.map((column) => csvCell(row[column])).join(","))
  }
  return lines.join("\n")
}
