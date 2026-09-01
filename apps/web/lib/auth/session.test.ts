import { describe, expect, it, vi } from "vitest"

process.env.SESSION_SECRET = "test-session-secret-not-for-real-use"

const cookieJar = new Map<string, string>()
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value)
    },
    delete: (name: string) => {
      cookieJar.delete(name)
    },
  }),
}))

import { decodeSession, encodeSession, hasListing, sessionNeedsRefresh, touchSession, type Session } from "./session"

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

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

  it("slides the cookie when less than half the TTL remains", async () => {
    const now = Date.now()
    const session = sample({ exp: now + SESSION_TTL_MS / 4 })
    expect(sessionNeedsRefresh(session, now)).toBe(true)
    expect(sessionNeedsRefresh(sample({ exp: now + SESSION_TTL_MS * 0.75 }), now)).toBe(false)
    const renewed = await touchSession(session)
    expect(renewed).toBe(true)
  })

  it("skips a touch when plenty of time remains", async () => {
    const renewed = await touchSession(sample({ exp: Date.now() + SESSION_TTL_MS * 0.9 }))
    expect(renewed).toBe(false)
  })
})
