import { describe, expect, it } from "vitest"
import { isActiveHref } from "./active-href"

describe("isActiveHref", () => {
  it("lights only the exact nav path", () => {
    expect(isActiveHref("/me/matches", "/me/matches")).toBe(true)
    expect(isActiveHref("/me/matches", "/me")).toBe(false)
    expect(isActiveHref("/me", "/me")).toBe(true)
  })

  it("ignores query strings on directory desks", () => {
    expect(isActiveHref("/directory", "/directory?challenge=recoding_medicine")).toBe(true)
    expect(isActiveHref("/directory", "/me")).toBe(false)
  })

  it("never treats hash-only programme links as current", () => {
    expect(isActiveHref("/", "/#programmes")).toBe(false)
  })
})
