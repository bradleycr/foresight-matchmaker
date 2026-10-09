import { afterEach, describe, expect, it, vi } from "vitest"
import { decodeStopToken, encodeStopToken } from "./token"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("nudge stop token", () => {
  it("round-trips an email and rejects a tampered signature", () => {
    vi.stubEnv("SESSION_SECRET", "test-nudge-secret")
    const token = encodeStopToken("Ada@Example.org")
    expect(decodeStopToken(token)).toBe("ada@example.org")
    expect(decodeStopToken(token.slice(0, -1) + "x")).toBeNull()
    expect(decodeStopToken("not-a-token")).toBeNull()
  })
})
