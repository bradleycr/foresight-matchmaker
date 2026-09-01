import { describe, expect, it } from "vitest"
import { longestWordLength, pairNameClass, tileNameClass } from "./name-fit"

const SHORT = "Helix Vision Labs"
const LONG = "Universitätsklinikum Nordharz — Datenintegrationszentrum"

describe("name fit", () => {
  it("shrinks tiles for the longest real listing names", () => {
    expect(tileNameClass(SHORT)).not.toEqual(tileNameClass(LONG))
    expect(tileNameClass(LONG)).toContain("0.6rem")
  })

  it("shrinks for one long compound even when the name is short overall", () => {
    // Same character count as a comfortable two-word name, but unbreakable.
    expect(tileNameClass("Datenintegrationszentrum")).toEqual(tileNameClass(LONG))
    expect(tileNameClass("Nordhavn Cancer Bank")).not.toEqual(tileNameClass("Datenintegrationszentrum"))
  })

  it("splits on dashes, so a hyphenated name is not treated as one word", () => {
    expect(longestWordLength("Rhine-Ruhr Imaging")).toBe(7)
    expect(longestWordLength(LONG)).toBe(24)
  })

  it("shrinks the pair cards too", () => {
    expect(pairNameClass(SHORT)).toBe("text-3xl")
    expect(pairNameClass(LONG)).toBe("text-xl")
  })

  it("ignores padding whitespace", () => {
    expect(tileNameClass(`  ${SHORT}  `)).toBe(tileNameClass(SHORT))
  })
})
