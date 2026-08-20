import { describe, expect, it } from "vitest"
import { attendingChoices, isWebinarOpen, WEBINAR_ATTENDING } from "./enums"

describe("attendingChoices", () => {
  it("never offers the webinar — listings are created after that session", () => {
    expect(isWebinarOpen(new Date("2026-08-19T12:00:00Z"))).toBe(false)
    expect(attendingChoices()).not.toContain(WEBINAR_ATTENDING)
    expect(attendingChoices()).toEqual(["event_sept_1", "event_sept_2", "event_sept_3", "remote_only"])
  })
})
