import { describe, expect, it } from "vitest"
import { attendingChoices, isWebinarOpen, WEBINAR_ATTENDING } from "./enums"

describe("attendingChoices", () => {
  it("includes the webinar before Friday 21 August 2026 UTC", () => {
    expect(isWebinarOpen(new Date("2026-08-20T23:59:00Z"))).toBe(true)
    expect(attendingChoices(new Date("2026-08-20T23:59:00Z"))).toContain(WEBINAR_ATTENDING)
  })

  it("hides the webinar from Thursday night into Friday 21 August 2026 UTC", () => {
    expect(isWebinarOpen(new Date("2026-08-21T00:00:00Z"))).toBe(false)
    expect(attendingChoices(new Date("2026-08-21T00:00:00Z"))).not.toContain(WEBINAR_ATTENDING)
  })
})
