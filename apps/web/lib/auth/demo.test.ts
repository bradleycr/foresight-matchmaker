import { afterEach, describe, expect, it } from "vitest"
import { resolveDemoCity, resolveDemoEmail, verifyDemoSecret, DEMO_EMAIL } from "@/lib/auth/demo"

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

describe("resolveDemoEmail / resolveDemoCity", () => {
  it("defaults blank email to the operator demo account", () => {
    expect(resolveDemoEmail("")).toBe(DEMO_EMAIL)
    expect(resolveDemoEmail("  ")).toBe(DEMO_EMAIL)
    expect(resolveDemoEmail("Robin.Wilkening@opening.science")).toBe("robin.wilkening@opening.science")
  })

  it("only accepts known room cities", () => {
    expect(resolveDemoCity("")).toBeNull()
    expect(resolveDemoCity("paris")).toBe("paris")
    expect(resolveDemoCity("PARIS")).toBe("paris")
    expect(resolveDemoCity("lyon")).toBeNull()
  })
})
