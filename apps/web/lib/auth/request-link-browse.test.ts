import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

process.env.DATABASE_PATH = ":memory:"
process.env.SESSION_SECRET = "test-session-secret-not-for-real-use"

afterEach(() => {
  vi.unstubAllEnvs()
})

function post(body: object) {
  return new NextRequest("http://localhost/api/v1/auth/request-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/v1/auth/request-link browse", () => {
  it("mints a real signed link for directory browse without a listing", async () => {
    vi.stubEnv("AUTH_REVEAL_LINKS", "true")
    vi.stubEnv("RESEND_API_KEY", "")
    vi.stubEnv("SMTP_URL", "")
    const { POST } = await import("@/app/api/v1/auth/request-link/route")
    const res = await POST(post({ email: "ada@example.org", next: "/directory" }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { claim_link?: string }
    expect(body.claim_link).toBeTruthy()
    expect(body.claim_link).toContain("~")
    expect(body.claim_link).toContain("next=%2Fdirectory")
  })

  it("mints a real signed link on bare sign-in for an unknown email", async () => {
    vi.stubEnv("AUTH_REVEAL_LINKS", "true")
    vi.stubEnv("RESEND_API_KEY", "")
    vi.stubEnv("SMTP_URL", "")
    const { POST } = await import("@/app/api/v1/auth/request-link/route")
    const res = await POST(post({ email: "nobody@example.org" }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { claim_link?: string }
    expect(body.claim_link).toBeTruthy()
    expect(body.claim_link).toContain("~")
    expect(body.claim_link).toContain("/claim/")
  })
})
