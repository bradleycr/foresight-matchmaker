import { describe, expect, it, vi } from "vitest"
import type { SignupRow } from "@/lib/db/signups"
import { NUDGE_DELAY_MS } from "./policy"
import { runListingNudges } from "./run"

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
const old = new Date(now.getTime() - NUDGE_DELAY_MS - 60_000).toISOString()

describe("runListingNudges", () => {
  it("sends one AI Safety Berlin reminder and records it", async () => {
    const send = vi.fn().mockResolvedValue({ sent: true })
    const recordSent = vi.fn().mockResolvedValue(undefined)
    const result = await runListingNudges({
      now,
      rows: [row({ contact_email: "ada@example.org", status: "requested", created_at: old })],
      alreadySent: new Set(),
      optedOut: new Set(),
      send,
      recordSent,
    })
    expect(result.sent).toBe(1)
    expect(result.eligible).toBe(1)
    expect(result.stopped).toBeNull()
    expect(send).toHaveBeenCalledTimes(1)
    const arg = send.mock.calls[0]![0] as { to: string; subject: string; idempotencyKey: string; headers: Record<string, string> }
    expect(arg.to).toBe("ada@example.org")
    expect(arg.subject).toContain("AI Safety Berlin")
    expect(arg.idempotencyKey).toBe("listing-nudge/ai_safety_berlin/ada@example.org/week_later")
    expect(arg.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
    expect(recordSent).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.org", challenge_id: "ai_safety_berlin", kind: "unopened" }),
    )
  })

  it("does not mail Recoding Medicine even when unfinished and old", async () => {
    const send = vi.fn()
    const result = await runListingNudges({
      now,
      rows: [
        row({
          contact_email: "rm@example.org",
          status: "confirmed",
          challenge_id: "recoding_medicine",
          created_at: old,
        }),
      ],
      alreadySent: new Set(),
      optedOut: new Set(),
      send,
      recordSent: vi.fn(),
    })
    expect(result.sent).toBe(0)
    expect(result.skipped.programme_off).toBe(1)
    expect(send).not.toHaveBeenCalled()
  })

  it("stops the run when Resend returns quota", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ sent: true })
      .mockResolvedValueOnce({ sent: false, reason: "quota" })
    const recordSent = vi.fn().mockResolvedValue(undefined)
    const result = await runListingNudges({
      now,
      rows: [
        row({ contact_email: "a@example.org", status: "confirmed", created_at: old }),
        row({ contact_email: "b@example.org", status: "confirmed", created_at: old }),
        row({ contact_email: "c@example.org", status: "confirmed", created_at: old }),
      ],
      alreadySent: new Set(),
      optedOut: new Set(),
      send,
      recordSent,
    })
    expect(result.sent).toBe(1)
    expect(result.stopped).toBe("quota")
    expect(send).toHaveBeenCalledTimes(2)
    expect(recordSent).toHaveBeenCalledTimes(1)
  })

  it("sends a selected Recoding Medicine row when the operator asks now", async () => {
    const send = vi.fn().mockResolvedValue({ sent: true })
    const recordSent = vi.fn().mockResolvedValue(undefined)
    const result = await runListingNudges({
      now,
      rows: [
        row({
          contact_email: "rm@example.org",
          status: "confirmed",
          challenge_id: "recoding_medicine",
          created_at: now.toISOString(),
        }),
      ],
      alreadySent: new Set(),
      optedOut: new Set(),
      requireAge: false,
      requireAutoNudge: false,
      emails: new Set(["rm@example.org"]),
      autoNudge: () => false,
      send,
      recordSent,
    })
    expect(result.sent).toBe(1)
    expect(send.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        to: "rm@example.org",
        idempotencyKey: "listing-nudge/recoding_medicine/rm@example.org/week_later",
      }),
    )
  })
})
