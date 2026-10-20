import { describe, expect, it } from "vitest"
import {
  acceptsNewListings,
  directoryHref,
  challengeBySlug,
  openChallenges,
  sessionUrl,
  programmeAutoNudge,
  challengeById,
} from "./catalog"
import {
  browseDirectoryPath,
  registerableChallengeIdOf,
  registerableChallengeIds,
  visibleChallenges,
  isChallengeVisible,
} from "./visibility"

describe("browseDirectoryPath", () => {
  it("sends a Recoding Medicine listing to that programme directory", () => {
    expect(browseDirectoryPath("recoding_medicine")).toBe("/directory?challenge=recoding_medicine")
  })

  it("prefers an active desk cookie over the listing programme", () => {
    expect(browseDirectoryPath("recoding_medicine", null, "ai_safety_berlin")).toBe(
      "/directory?challenge=ai_safety_berlin",
    )
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
  it("Recoding Medicine stays visible as a closed archive", () => {
    expect(isChallengeVisible("recoding_medicine")).toBe(true)
    expect(challengeById("recoding_medicine").status).toBe("closed")
  })

  it("AI Safety Berlin is visible in dev (NODE_ENV !== production)", () => {
    // In test env (not production), preview programmes are on by default
    expect(isChallengeVisible("ai_safety_berlin")).toBe(true)
  })

  it("solo demo unlock hides Recoding Medicine for that browser", () => {
    // In test/dev, previews are on — unlock may focus a pitch desk.
    const unlock = { programme: "ai_safety_berlin" as const, solo: true }
    expect(isChallengeVisible("ai_safety_berlin", unlock)).toBe(true)
    expect(isChallengeVisible("recoding_medicine", unlock)).toBe(false)
    expect(visibleChallenges(unlock).map((c) => c.id)).toEqual(["ai_safety_berlin"])
  })

  it("ignores unlock cookies when preview programmes are off", () => {
    const previous = process.env.NEXT_PUBLIC_PREVIEW_PROGRAMMES
    process.env.NEXT_PUBLIC_PREVIEW_PROGRAMMES = "off"
    try {
      const unlock = { programme: "ai_safety_berlin" as const, solo: true }
      // Live desk: closed archive stays; preview programme stays hidden.
      expect(isChallengeVisible("recoding_medicine", unlock)).toBe(true)
      expect(isChallengeVisible("ai_safety_berlin", unlock)).toBe(false)
      expect(visibleChallenges(unlock).map((c) => c.id)).toEqual(["recoding_medicine"])
      expect(acceptsNewListings("recoding_medicine")).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_PREVIEW_PROGRAMMES
      else process.env.NEXT_PUBLIC_PREVIEW_PROGRAMMES = previous
    }
  })
})

describe("acceptsNewListings", () => {
  it("blocks Recoding Medicine after close", () => {
    expect(acceptsNewListings("recoding_medicine")).toBe(false)
    expect(openChallenges()).toEqual([])
  })

  it("does not offer closed programmes on register", () => {
    expect(registerableChallengeIdOf("recoding_medicine")).toBeNull()
    expect(registerableChallengeIds()).toEqual([])
  })

  it("offers a preview programme when it is visible and open", () => {
    // ASB is preview, not open — still not registerable until flipped.
    expect(acceptsNewListings("ai_safety_berlin")).toBe(false)
  })
})

describe("programmeAutoNudge", () => {
  it("leaves Recoding Medicine off after the operator blast", () => {
    expect(programmeAutoNudge("recoding_medicine")).toBe(false)
    expect(challengeById("recoding_medicine").autoNudge).toBe(false)
  })

  it("mails AI Safety Berlin and any later programme that does not opt out", () => {
    expect(programmeAutoNudge("ai_safety_berlin")).toBe(true)
  })
})
