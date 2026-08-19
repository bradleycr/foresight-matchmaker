import { describe, expect, it } from "vitest"
import { pasteLooksLikeUrlOnly } from "./paste-is-url"

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
