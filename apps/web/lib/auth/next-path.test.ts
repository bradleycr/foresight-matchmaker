import { describe, expect, it } from "vitest"
import { afterClaimHref, isBrowsePath, isHerePath, isRegisterPath, needsEmailVerify, safeNextPath, signInHref } from "./next-path"

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

describe("isRegisterPath", () => {
  it("accepts the listing form with an optional programme", () => {
    expect(isRegisterPath("/register")).toBe(true)
    expect(isRegisterPath("/register?challenge=recoding")).toBe(true)
    expect(isRegisterPath("/me")).toBe(false)
  })
})

describe("isHerePath", () => {
  it("accepts a room check-in URL", () => {
    expect(isHerePath("/here/berlin")).toBe(true)
    expect(isHerePath("/here/paris")).toBe(true)
    expect(isHerePath("/here/berlin/board")).toBe(false)
    expect(isHerePath("/live-feed/berlin")).toBe(false)
  })
})

describe("needsEmailVerify", () => {
  it("confirms every mailbox, including bare sign-in with no listing yet", () => {
    expect(needsEmailVerify("/directory")).toBe(true)
    expect(needsEmailVerify("/directory?challenge=recoding_medicine")).toBe(true)
    expect(needsEmailVerify("/register")).toBe(true)
    expect(needsEmailVerify(null)).toBe(true)
    expect(needsEmailVerify("/me")).toBe(true)
    expect(isBrowsePath("/me")).toBe(false)
  })
})

describe("afterClaimHref", () => {
  it("sends a confirmed address with no listing to the form", () => {
    expect(afterClaimHref(null, "/register")).toBe("/register")
    expect(afterClaimHref(null, "/register?challenge=x")).toBe("/register?challenge=x")
    expect(afterClaimHref(null)).toBe("/register")
  })

  it("sends confirmed visitors to the directory they asked for, even without a listing yet", () => {
    expect(afterClaimHref(null, "/directory")).toBe("/directory")
    expect(afterClaimHref(null, "/directory?challenge=recoding_medicine")).toBe(
      "/directory?challenge=recoding_medicine",
    )
  })

  it("sends an existing listing to /me, not back through register", () => {
    expect(afterClaimHref("prof-1", "/register")).toBe("/me")
    expect(afterClaimHref("prof-1", "/directory")).toBe("/directory")
    expect(afterClaimHref("prof-1")).toBe("/me")
  })

  it("returns a room check-in after confirm", () => {
    expect(afterClaimHref("prof-1", "/here/berlin")).toBe("/here/berlin")
    expect(afterClaimHref(null, "/here/berlin")).toBe("/here/berlin")
  })
})
