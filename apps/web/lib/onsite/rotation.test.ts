import { describe, expect, it } from "vitest"
import { SPOTLIGHT_MS, msUntilNextSpotlight, spotlightIndex } from "./rotation"

describe("spotlight rotation", () => {
  it("counts down to the next slot boundary", () => {
    expect(msUntilNextSpotlight(0)).toBe(SPOTLIGHT_MS)
    expect(msUntilNextSpotlight(SPOTLIGHT_MS - 1_000)).toBe(1_000)
    expect(msUntilNextSpotlight(SPOTLIGHT_MS * 7 + 5_000)).toBe(SPOTLIGHT_MS - 5_000)
  })

  it("never reports zero, so the board never shows a stalled 0s", () => {
    for (const now of [0, 1, SPOTLIGHT_MS, SPOTLIGHT_MS * 3]) {
      expect(msUntilNextSpotlight(now)).toBeGreaterThan(0)
    }
  })

  it("advances the index exactly when the countdown resets", () => {
    const before = SPOTLIGHT_MS - 1
    expect(spotlightIndex(before, 3)).toBe(0)
    expect(spotlightIndex(before + 1, 3)).toBe(1)
  })

  it("wraps back to the first pair", () => {
    expect(spotlightIndex(SPOTLIGHT_MS * 3, 3)).toBe(0)
  })

  it("stays in range when there are no pairs", () => {
    expect(spotlightIndex(12_345, 0)).toBe(0)
  })
})
