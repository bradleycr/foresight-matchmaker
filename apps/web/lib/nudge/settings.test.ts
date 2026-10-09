import { describe, expect, it } from "vitest"
import { resolvedAutoNudge } from "./settings"

describe("resolvedAutoNudge", () => {
  it("uses the catalogue until an operator override exists", () => {
    expect(resolvedAutoNudge("recoding_medicine", new Map())).toBe(false)
    expect(resolvedAutoNudge("ai_safety_berlin", new Map())).toBe(true)
  })

  it("lets /admin turn a catalogue-off programme on", () => {
    expect(resolvedAutoNudge("recoding_medicine", new Map([["recoding_medicine", true]]))).toBe(true)
    expect(resolvedAutoNudge("ai_safety_berlin", new Map([["ai_safety_berlin", false]]))).toBe(false)
  })
})
