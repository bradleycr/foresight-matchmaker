import { describe, expect, it } from "vitest"
import { directoryHref, challengeBySlug, sessionUrl } from "./catalog"
import { browseDirectoryPath, visibleChallenges, isChallengeVisible } from "./visibility"

describe("browseDirectoryPath", () => {
  it("sends a Recoding Medicine listing to that programme directory", () => {
    expect(browseDirectoryPath("recoding_medicine")).toBe("/directory?challenge=recoding_medicine")
  })

  it("falls back when there is no listing yet", () => {
    const visible = visibleChallenges()
    if (visible.length === 1) {
      expect(browseDirectoryPath(null)).toBe(directoryHref(visible[0]!.id))
    } else {
      // With multiple visible programmes and no listing → chooser
      expect(browseDirectoryPath(null)).toBe("/directory")
    }
  })
})

describe("challengeBySlug", () => {
  it("finds AI Safety Berlin by slug", () => {
    expect(challengeBySlug("ai-safety-berlin")?.id).toBe("ai_safety_berlin")
  })
})

describe("sessionUrl", () => {
  it("falls back to calendarUrl for sessions without a per-session URL", () => {
    const asb = challengeBySlug("ai-safety-berlin")!
    expect(sessionUrl(asb, "asb_coworking")).toBe("https://luma.com/AISafetyBerlin")
  })
})

describe("visibility", () => {
  it("Recoding Medicine is always visible (status open)", () => {
    expect(isChallengeVisible("recoding_medicine")).toBe(true)
  })

  it("AI Safety Berlin is visible in dev (NODE_ENV !== production)", () => {
    // In test env (not production), preview programmes are on by default
    expect(isChallengeVisible("ai_safety_berlin")).toBe(true)
  })
})
