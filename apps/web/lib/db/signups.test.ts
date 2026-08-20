import { describe, expect, it } from "vitest"
import { collectSignupRows, signupsToCsv } from "./signups"

process.env.DATABASE_PATH = ":memory:"
process.env.BLOB_READ_WRITE_TOKEN = ""

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
