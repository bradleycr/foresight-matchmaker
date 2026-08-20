import { afterEach, describe, expect, it, vi } from "vitest"
import { magicLinkMode, mailConfigured, revealLinksAllowed, sendMail, sendMagicLink } from "./mail"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("mailConfigured", () => {
  it("is off with neither transport", () => {
    vi.stubEnv("RESEND_API_KEY", "")
    vi.stubEnv("SMTP_URL", "")
    expect(mailConfigured()).toBe(false)
  })

  it("is on with a Resend key", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    expect(mailConfigured()).toBe(true)
  })
})

describe("magicLinkMode", () => {
  it("emails when Resend is set, even if AUTH_REVEAL_LINKS is still on (reveal is fallback only)", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("AUTH_REVEAL_LINKS", "true")
    expect(revealLinksAllowed()).toBe(true)
    expect(magicLinkMode()).toBe("email")
  })

  it("emails when Resend is set and reveal is off", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("AUTH_REVEAL_LINKS", "false")
    expect(magicLinkMode()).toBe("email")
    expect(revealLinksAllowed()).toBe(false)
  })
})

describe("sendMail", () => {
  it("posts to Resend when RESEND_API_KEY is set", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("SMTP_FROM", "Foresight Matchmaking <hello@foresightmatchmaker.app>")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "{}",
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await sendMail({ to: "ada@example.org", subject: "Hello", text: "Hi" })
    expect(result).toEqual({ sent: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.resend.com/emails")
    expect(init.method).toBe("POST")
    const body = JSON.parse(String(init.body)) as { from: string; to: string[] }
    expect(body.from).toBe("Foresight Matchmaking <hello@foresightmatchmaker.app>")
    expect(body.to).toEqual(["ada@example.org"])
  })
})

describe("sendMagicLink", () => {
  it("sends a welcome subject when a listing is created", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "{}" })
    vi.stubGlobal("fetch", fetchMock)
    await sendMagicLink("ada@example.org", "https://foresightmatchmaker.app/claim/abc", "welcome")
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
      subject: string
      html: string
    }
    expect(body.subject).toBe("Confirm your email — Foresight Matchmaking")
    expect(body.html).toContain("#edcf5a")
    expect(body.html).toContain("Confirm email")
  })
})
