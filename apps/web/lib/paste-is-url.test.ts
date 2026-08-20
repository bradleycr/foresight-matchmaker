import { describe, expect, it } from "vitest"
import { pasteLooksLikeUrlOnly, websiteFromPaste } from "./paste-is-url"

describe("pasteLooksLikeUrlOnly", () => {
  it("treats a bare URL as link-only", () => {
    expect(pasteLooksLikeUrlOnly("https://example.org/about")).toBe(true)
    expect(pasteLooksLikeUrlOnly("http://uni-berlin.de/forschung")).toBe(true)
    expect(pasteLooksLikeUrlOnly("www.charite.de")).toBe(true)
  })

  it("treats a URL with a short caption as link-only", () => {
    expect(pasteLooksLikeUrlOnly("About page: https://example.org/about")).toBe(true)
  })

  it("lets through real prose even if it contains a URL", () => {
    expect(
      pasteLooksLikeUrlOnly(
        "We are a university hospital holding a longitudinal oncology imaging cohort of 40,000 patients. More at https://example.org/about",
      ),
    ).toBe(false)
  })

  it("lets through ordinary about text", () => {
    expect(pasteLooksLikeUrlOnly("We hold a consented imaging cohort in Berlin.")).toBe(false)
  })
})

describe("websiteFromPaste", () => {
  it("normalizes a pasted link for the Website field", () => {
    expect(websiteFromPaste("https://charite.de")).toBe("https://charite.de/")
    expect(websiteFromPaste("charite.de")).toBe("https://charite.de/")
    expect(websiteFromPaste("About page: https://example.org/about")).toMatch(/^https:\/\/example\.org\/about\/?$/)
  })

  it("returns null for prose", () => {
    expect(websiteFromPaste("We hold a consented imaging cohort in Berlin.")).toBeNull()
  })
})

describe("pasteLooksLikeUrlOnly", () => {
  it("treats a bare URL as link-only", () => {
    expect(pasteLooksLikeUrlOnly("https://example.org/about")).toBe(true)
    expect(pasteLooksLikeUrlOnly("http://uni-berlin.de/forschung")).toBe(true)
  })

  it("treats a URL with a short caption as link-only", () => {
    expect(pasteLooksLikeUrlOnly("About page: https://example.org/about")).toBe(true)
  })

  it("lets through real prose even if it contains a URL", () => {
    expect(
      pasteLooksLikeUrlOnly(
        "We are a university hospital holding a longitudinal oncology imaging cohort of 40,000 patients. More at https://example.org/about",
      ),
    ).toBe(false)
  })

  it("lets through ordinary about text", () => {
    expect(pasteLooksLikeUrlOnly("We hold a consented imaging cohort in Berlin.")).toBe(false)
  })
})
