import { describe, expect, it } from "vitest"
import { localeCookie, LOCALE_COOKIE } from "./index"

describe("localeCookie", () => {
  it("writes a year-long host cookie the switcher can set before refresh", () => {
    expect(localeCookie("de")).toBe(`${LOCALE_COOKIE}=de;path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`)
  })
})
