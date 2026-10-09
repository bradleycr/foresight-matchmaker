import { describe, expect, it } from "vitest"
import { parseResendSyncMarker, resendSyncShouldStop, RESEND_NUDGE_FLOOR } from "./resend-sync"

describe("resend blast import", () => {
  it("resumes from a saved page cursor", () => {
    expect(
      parseResendSyncMarker({ complete: false, imported: 12, last_created_at: "2026-10-06T12:00:00.000Z", after: "email_1" }),
    ).toEqual({
      complete: false,
      imported: 12,
      last_created_at: "2026-10-06T12:00:00.000Z",
      after: "email_1",
    })
  })

  it("keeps walking while the oldest row on the page is still after the blast", () => {
    expect(
      resendSyncShouldStop(
        [
          { id: "a", created_at: "2026-10-09T10:00:00.000Z" },
          { id: "b", created_at: "2026-10-08T10:00:00.000Z" },
        ],
        true,
      ),
    ).toBe(false)
  })

  it("stops once a page walks older than the 5 October blast", () => {
    expect(
      resendSyncShouldStop(
        [
          { id: "a", created_at: "2026-10-05T08:00:00.000Z" },
          { id: "b", created_at: "2026-10-04T22:00:00.000Z" },
        ],
        true,
      ),
    ).toBe(true)
    expect(RESEND_NUDGE_FLOOR < "2026-10-05T08:00:00.000Z").toBe(true)
  })
})
