import { afterEach, describe, expect, it, vi } from "vitest"
import { cronAuthorized } from "./cron-auth"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("cronAuthorized", () => {
  it("fails closed without CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", "")
    const req = new Request("https://foresightmatchmaker.app/api/cron/listing-nudges", {
      headers: { authorization: "Bearer x" },
    })
    expect(cronAuthorized(req)).toBe(false)
  })

  it("accepts the bearer secret Vercel Cron sends", () => {
    vi.stubEnv("CRON_SECRET", "cron-test")
    const ok = new Request("https://foresightmatchmaker.app/api/cron/listing-nudges", {
      headers: { authorization: "Bearer cron-test" },
    })
    const no = new Request("https://foresightmatchmaker.app/api/cron/listing-nudges")
    expect(cronAuthorized(ok)).toBe(true)
    expect(cronAuthorized(no)).toBe(false)
  })
})
