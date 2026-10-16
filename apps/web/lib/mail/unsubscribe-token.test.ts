import { afterEach, describe, expect, it, vi } from "vitest"
import { decodeMailOptOutToken, encodeMailOptOutToken } from "./unsubscribe-token"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("mail opt-out token", () => {
  it("round-trips an email and rejects a tampered signature", () => {
    vi.stubEnv("SESSION_SECRET", "test-mail-optout-secret")
    const token = encodeMailOptOutToken("Bradley@Forza.org")
    expect(decodeMailOptOutToken(token)).toBe("bradley@forza.org")
    expect(decodeMailOptOutToken(token.slice(0, -1) + "x")).toBeNull()
    expect(decodeMailOptOutToken("not-a-token")).toBeNull()
  })
})
