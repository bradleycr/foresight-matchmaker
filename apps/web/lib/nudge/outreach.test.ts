import { describe, expect, it } from "vitest"
import type { SignupRow } from "@/lib/db/signups"
import { summarizeOutreach } from "./outreach"

function row(partial: Partial<SignupRow> & Pick<SignupRow, "contact_email" | "status">): SignupRow {
  return {
    created_at: "2026-09-01T00:00:00.000Z",
    last_seen_at: "2026-09-02T00:00:00.000Z",
    contact_name: "",
    contact_role: "",
    org_name: "",
    kind: "",
    org_type: "",
    country: "",
    challenge_id: "recoding_medicine",
    completeness: "",
    visibility: "",
    website: "",
    ...partial,
  }
}

describe("summarizeOutreach", () => {
  it("splits unpublished rows by whether a reminder is on file", () => {
    const sent = new Set(["recoding_medicine:ada@example.org", "recoding_medicine:cam@example.org"])
    const out = summarizeOutreach(
      [
        row({ contact_email: "ada@example.org", status: "confirmed" }),
        row({ contact_email: "bea@example.org", status: "requested" }),
        row({ contact_email: "cam@example.org", status: "listed" }),
      ],
      sent,
    )
    expect(out.remindedUnfinished.map((r) => r.contact_email)).toEqual(["ada@example.org"])
    expect(out.notRemindedUnfinished.map((r) => r.contact_email)).toEqual(["bea@example.org"])
    expect(out.remindedListed).toBe(1)
  })
})
