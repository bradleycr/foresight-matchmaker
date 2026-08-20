import { describe, expect, it } from "vitest"

process.env.DATABASE_PATH = ":memory:"
process.env.SESSION_SECRET = "test-session-secret-not-for-real-use"

const { consumeToken, issueToken } = await import("./tokens")

describe("signed magic links", () => {
  it("round-trips an email with no listing", () => {
    const token = issueToken("ada@example.org")
    expect(token).toContain("~")
    expect(token).not.toContain(".")
    const result = consumeToken(token)
    expect(result).toEqual({ ok: true, email: "ada@example.org", profileId: null })
  })

  it("still works when this instance has no sqlite row", () => {
    const token = issueToken("ada@example.org", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    const result = consumeToken(` ${token} `)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.email).toBe("ada@example.org")
      expect(result.profileId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    }
  })

  it("rejects a forged payload", () => {
    const token = issueToken("ada@example.org")
    const [body] = token.split("~")
    expect(consumeToken(`${body}~not-a-signature-value-pad`)).toEqual({ ok: false, error: "invalid" })
  })
})
