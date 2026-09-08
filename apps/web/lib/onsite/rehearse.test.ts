import { describe, expect, it } from "vitest"
import { parseRehearseCount } from "./rehearse"

describe("parseRehearseCount", () => {
  it("ignores rehearsal on production", () => {
    const previous = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = "production"
    expect(parseRehearseCount("2")).toBeNull()
    if (previous === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previous
  })

  it("accepts a board size locally", () => {
    const previous = process.env.VERCEL_ENV
    delete process.env.VERCEL_ENV
    expect(parseRehearseCount("1")).toBe(1)
    expect(parseRehearseCount("2")).toBe(2)
    expect(parseRehearseCount("0")).toBeNull()
    expect(parseRehearseCount("99")).toBeNull()
    if (previous === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = previous
  })
})
