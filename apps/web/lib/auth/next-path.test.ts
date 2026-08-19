import { describe, expect, it } from "vitest"
import { safeNextPath, signInHref } from "./next-path"

describe("safeNextPath", () => {
  it("accepts same-origin relative pages", () => {
    expect(safeNextPath("/register")).toBe("/register")
    expect(safeNextPath("/me/matches")).toBe("/me/matches")
  })

  it("rejects off-site, protocol-relative, and auth loops", () => {
    expect(safeNextPath("https://evil.example/x")).toBeNull()
    expect(safeNextPath("//evil.example")).toBeNull()
    expect(safeNextPath("/signin")).toBeNull()
    expect(safeNextPath("/claim/abc")).toBeNull()
  })

  it("rejects API paths so logout next cannot bounce into itself", () => {
    expect(safeNextPath("/api/v1/auth/logout")).toBeNull()
    expect(safeNextPath("/api")).toBeNull()
  })
})

describe("signInHref", () => {
  it("omits an unsafe next", () => {
    expect(signInHref("/api/v1/auth/logout")).toBe("/signin")
    expect(signInHref("/register")).toBe("/signin?next=%2Fregister")
  })
})
