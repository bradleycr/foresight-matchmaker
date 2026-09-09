import { afterEach, describe, expect, it } from "vitest"
import { verifyDemoSecret } from "@/lib/auth/demo"

const original = process.env.DEMO_SECRET

afterEach(() => {
  if (original === undefined) delete process.env.DEMO_SECRET
  else process.env.DEMO_SECRET = original
})

describe("verifyDemoSecret", () => {
  it("accepts FSRM2026! when DEMO_SECRET is unset", () => {
    delete process.env.DEMO_SECRET
    expect(verifyDemoSecret("FSRM2026!")).toBe(true)
    expect(verifyDemoSecret("password123")).toBe(false)
    expect(verifyDemoSecret("nope")).toBe(false)
  })

  it("still accepts FSRM2026! when DEMO_SECRET is a different value", () => {
    process.env.DEMO_SECRET = "rotated-demo-secret"
    expect(verifyDemoSecret("FSRM2026!")).toBe(true)
    expect(verifyDemoSecret("rotated-demo-secret")).toBe(true)
    expect(verifyDemoSecret("password123")).toBe(false)
  })

  it("trims accidental whitespace around the submitted secret", () => {
    delete process.env.DEMO_SECRET
    expect(verifyDemoSecret("  FSRM2026!  ")).toBe(true)
    expect(verifyDemoSecret("")).toBe(false)
  })
})
