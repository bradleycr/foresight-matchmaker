import { describe, expect, it } from "vitest"
import {
  collectSignupRows,
  signupBelongsToChallenge,
  signupsToCsv,
  sortSignupsForOperator,
  summarizeSignups,
  type SignupRow,
} from "./signups"

process.env.DATABASE_PATH = ":memory:"
process.env.BLOB_READ_WRITE_TOKEN = ""

function row(partial: Partial<SignupRow> & Pick<SignupRow, "contact_email" | "status">): SignupRow {
  return {
    created_at: "2026-08-01T00:00:00.000Z",
    last_seen_at: "2026-08-02T00:00:00.000Z",
    contact_name: "",
    contact_role: "",
    org_name: "",
    kind: "",
    org_type: "",
    country: "",
    challenge_id: "",
    completeness: "",
    visibility: "",
    website: "",
    ...partial,
  }
}

describe("signup register", () => {
  it("exports a CSV header that includes status even when empty", () => {
    const csv = signupsToCsv([])
    expect(csv.split("\n")[0]).toBe(
      "created_at,last_seen_at,status,contact_email,contact_name,contact_role,org_name,kind,org_type,country,challenge_id,completeness,visibility,website",
    )
  })

  it("returns no rows when Blob is off and SQLite has no listings", async () => {
    expect(await collectSignupRows()).toEqual([])
  })
})

describe("signup drop-off", () => {
  const requested = row({ contact_email: "a@x.org", status: "requested", last_seen_at: "2026-08-03T00:00:00.000Z" })
  const confirmed = row({ contact_email: "b@x.org", status: "confirmed", last_seen_at: "2026-08-04T00:00:00.000Z" })
  const listed = row({
    contact_email: "c@x.org",
    status: "listed",
    challenge_id: "recoding_medicine",
    last_seen_at: "2026-08-05T00:00:00.000Z",
  })

  it("counts signups against listings and isolates signed-in unpublished emails", () => {
    const summary = summarizeSignups([requested, confirmed, listed])
    expect(summary).toMatchObject({
      total: 3,
      requested: 1,
      confirmed: 1,
      listed: 1,
      signed_in: 2,
      unfinished: 2,
    })
    expect(summary.unfinishedConfirmedEmails).toEqual(["b@x.org"])
    expect(summary.unfinishedEmails).toEqual(["a@x.org", "b@x.org"])
  })

  it("sorts confirmed-but-unpublished ahead of link-requested and listed", () => {
    expect(sortSignupsForOperator([listed, requested, confirmed]).map((r) => r.status)).toEqual([
      "confirmed",
      "requested",
      "listed",
    ])
  })

  it("counts unattributed unfinished rows on the live programme", () => {
    expect(signupBelongsToChallenge(requested, "recoding_medicine")).toBe(true)
    expect(signupBelongsToChallenge(requested, "other")).toBe(false)
    expect(signupBelongsToChallenge(listed, "recoding_medicine")).toBe(true)
  })
})
