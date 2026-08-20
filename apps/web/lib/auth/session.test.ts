import { describe, expect, it } from "vitest"

process.env.SESSION_SECRET = "test-session-secret-not-for-real-use"

import { decodeSession, encodeSession, hasListing, type Session } from "./session"

function sample(overrides: Partial<Session> = {}): Session {
  return {
    profileId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    email: "ada@example.org",
    exp: Date.now() + 60_000,
    ...overrides,
  }
}

describe("session cookie", () => {
  it("round-trips a listing session", () => {
    const session = sample()
    expect(decodeSession(encodeSession(session))).toEqual(session)
    expect(hasListing(session)).toBe(true)
  })

  it("round-trips a confirmed email with no listing yet", () => {
    const session = sample({ profileId: null })
    expect(decodeSession(encodeSession(session))).toEqual(session)
    expect(hasListing(session)).toBe(false)
  })

  it("rejects a forged payload", () => {
    const [payload] = encodeSession(sample()).split(".")
    expect(decodeSession(`${payload}.not-a-signature`)).toBeNull()
  })
})
