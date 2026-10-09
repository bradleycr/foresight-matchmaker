import { describe, expect, it } from "vitest"
import type { SignupRow } from "@/lib/db/signups"
import { NUDGE_DELAY_MS, selectNudgeCandidates } from "./policy"

function row(partial: Partial<SignupRow> & Pick<SignupRow, "contact_email" | "status">): SignupRow {
  return {
    created_at: "2026-09-01T00:00:00.000Z",
    last_seen_at: "2026-09-01T00:00:00.000Z",
    contact_name: "",
    contact_role: "",
    org_name: "",
    kind: "",
    org_type: "",
    country: "",
    challenge_id: "ai_safety_berlin",
    completeness: "",
    visibility: "",
    website: "",
    ...partial,
  }
}

const now = new Date("2026-09-20T12:00:00.000Z")

describe("selectNudgeCandidates", () => {
  it("selects a week-old unfinished AI Safety Berlin signup", () => {
    const { candidates, skipped } = selectNudgeCandidates(
      [
        row({
          contact_email: "ada@example.org",
          status: "confirmed",
          created_at: new Date(now.getTime() - NUDGE_DELAY_MS - 1_000).toISOString(),
        }),
      ],
      { now, alreadySent: new Set(), optedOut: new Set() },
    )
    expect(candidates).toEqual([
      expect.objectContaining({
        email: "ada@example.org",
        challengeId: "ai_safety_berlin",
        kind: "unpublished",
      }),
    ])
    expect(skipped.programme_off).toBe(0)
  })

  it("never mails Recoding Medicine or unassigned (default) unfinished rows", () => {
    const { candidates, skipped } = selectNudgeCandidates(
      [
        row({
          contact_email: "rm@example.org",
          status: "confirmed",
          challenge_id: "recoding_medicine",
        }),
        row({
          contact_email: "bare@example.org",
          status: "requested",
          challenge_id: "",
        }),
      ],
      { now, alreadySent: new Set(), optedOut: new Set() },
    )
    expect(candidates).toEqual([])
    expect(skipped.programme_off).toBe(2)
  })

  it("skips listed, young, opted-out, already-sent, and operator inboxes", () => {
    const young = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const { candidates, skipped } = selectNudgeCandidates(
      [
        row({ contact_email: "listed@example.org", status: "listed" }),
        row({ contact_email: "new@example.org", status: "requested", created_at: young }),
        row({ contact_email: "stop@example.org", status: "confirmed" }),
        row({ contact_email: "sent@example.org", status: "confirmed" }),
        row({ contact_email: "bradley@foresight.org", status: "confirmed" }),
        row({ contact_email: "seed@example.invalid", status: "confirmed" }),
      ],
      {
        now,
        alreadySent: new Set(["ai_safety_berlin:sent@example.org"]),
        optedOut: new Set(["stop@example.org"]),
      },
    )
    expect(candidates).toEqual([])
    expect(skipped.listed).toBe(1)
    expect(skipped.too_young).toBe(1)
    expect(skipped.opted_out).toBe(1)
    expect(skipped.already_sent).toBe(1)
    expect(skipped.operator).toBe(1)
    expect(skipped.invalid).toBe(1)
  })

  it("lets an operator send skip the week wait and the programme switch", () => {
    const young = new Date(now.getTime() - 60_000).toISOString()
    const { candidates } = selectNudgeCandidates(
      [
        row({
          contact_email: "ada@example.org",
          status: "confirmed",
          challenge_id: "recoding_medicine",
          created_at: young,
        }),
      ],
      {
        now,
        alreadySent: new Set(),
        optedOut: new Set(),
        requireAge: false,
        requireAutoNudge: false,
      },
    )
    expect(candidates).toEqual([
      expect.objectContaining({ email: "ada@example.org", challengeId: "recoding_medicine" }),
    ])
  })

  it("filters to an explicit mailbox list", () => {
    const { candidates } = selectNudgeCandidates(
      [
        row({ contact_email: "ada@example.org", status: "confirmed" }),
        row({ contact_email: "other@example.org", status: "confirmed" }),
      ],
      {
        now,
        alreadySent: new Set(),
        optedOut: new Set(),
        requireAge: false,
        requireAutoNudge: false,
        emails: new Set(["ada@example.org"]),
      },
    )
    expect(candidates.map((c) => c.email)).toEqual(["ada@example.org"])
  })
})
