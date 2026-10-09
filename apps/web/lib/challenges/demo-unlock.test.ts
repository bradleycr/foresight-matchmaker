import { afterEach, describe, expect, it, vi } from "vitest"
import { parseDemoUnlock, sealDemoUnlock, resolveDemoProgramme, demoTokenValid } from "./demo-unlock"

describe("demo unlock", () => {
  const secret = "demo-test-secret"

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("round-trips a solo unlock", () => {
    const sealed = sealDemoUnlock({ programme: "ai_safety_berlin", solo: true }, secret)
    expect(sealed).toBeTruthy()
    expect(parseDemoUnlock(sealed!, secret)).toEqual({ programme: "ai_safety_berlin", solo: true })
  })

  it("rejects a tampered cookie", () => {
    const sealed = sealDemoUnlock({ programme: "ai_safety_berlin", solo: true }, secret)!
    expect(parseDemoUnlock(sealed.slice(0, -2) + "xx", secret)).toBeNull()
  })

  it("resolves programme by slug or id", () => {
    expect(resolveDemoProgramme("ai-safety-berlin")).toBe("ai_safety_berlin")
    expect(resolveDemoProgramme("ai_safety_berlin")).toBe("ai_safety_berlin")
    expect(resolveDemoProgramme("nope")).toBeNull()
  })

  it("checks the share-link token against the secret", () => {
    vi.stubEnv("PREVIEW_DEMO_SECRET", "share-me")
    expect(demoTokenValid("share-me")).toBe(true)
    expect(demoTokenValid("wrong")).toBe(false)
  })
})
