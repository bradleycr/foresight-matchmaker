import { describe, expect, it } from "vitest"
import {
  attendingChoices,
  isWebinarOpen,
  WEBINAR_ATTENDING,
  isAttendingOfChallenge,
  kindsForChallenge,
  lookingForChoices,
} from "./enums"

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

describe("kindsForChallenge", () => {
  it("keeps Recoding Medicine's four applicant kinds", () => {
    expect(kindsForChallenge("recoding_medicine")).toEqual([
      "data_holder",
      "ai_team",
      "consortium",
      "individual",
    ])
  })

  it("lists only people for AI Safety Berlin coworking", () => {
    expect(kindsForChallenge("ai_safety_berlin")).toEqual(["individual"])
  })
})

describe("lookingForChoices", () => {
  it("keeps medicine partnership chips on Recoding Medicine", () => {
    expect(lookingForChoices("recoding_medicine")).toContain("dataset_access")
    expect(lookingForChoices("recoding_medicine")).not.toContain("collaborators")
  })

  it("offers coworking intents for AI Safety Berlin", () => {
    expect(lookingForChoices("ai_safety_berlin")).toEqual([
      "collaborators",
      "career_chat",
      "feedback",
      "co_host",
      "introductions",
      "join_team",
      "not_looking",
      "other",
    ])
  })
})
