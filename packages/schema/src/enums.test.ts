import { describe, expect, it } from "vitest"
import { attendingChoices, isWebinarOpen, WEBINAR_ATTENDING, isAttendingOfChallenge } from "./enums"

describe("attendingChoices", () => {
  it("never offers the webinar — listings are created after that session", () => {
    expect(isWebinarOpen(new Date("2026-08-19T12:00:00Z"))).toBe(false)
    expect(attendingChoices("recoding_medicine")).not.toContain(WEBINAR_ATTENDING)
    expect(attendingChoices("recoding_medicine")).toEqual(["event_sept_1", "event_sept_2", "event_sept_3", "remote_only"])
  })

  it("returns AI Safety Berlin sessions for ai_safety_berlin", () => {
    const chips = attendingChoices("ai_safety_berlin")
    expect(chips).toEqual(["asb_coworking", "asb_lunch", "asb_talks", "remote_only"])
  })

  it("defaults to the first programme when called without arguments", () => {
    expect(attendingChoices()).toEqual(attendingChoices("recoding_medicine"))
  })
})

describe("isAttendingOfChallenge", () => {
  it("rejects cross-programme chips", () => {
    expect(isAttendingOfChallenge("asb_coworking", "recoding_medicine")).toBe(false)
    expect(isAttendingOfChallenge("event_sept_1", "ai_safety_berlin")).toBe(false)
  })

  it("accepts the webinar chip on recoding_medicine only", () => {
    expect(isAttendingOfChallenge(WEBINAR_ATTENDING, "recoding_medicine")).toBe(true)
    expect(isAttendingOfChallenge(WEBINAR_ATTENDING, "ai_safety_berlin")).toBe(false)
  })
})
