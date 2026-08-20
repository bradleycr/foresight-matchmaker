import { describe, expect, it } from "vitest"
import { formatErrorDetails, mailtoHref, truncateForMailto } from "./contact"

describe("truncateForMailto", () => {
  it("leaves short text alone", () => {
    expect(truncateForMailto("hello")).toBe("hello")
  })

  it("caps long text so mailto URLs stay usable", () => {
    const long = "x".repeat(2000)
    const cut = truncateForMailto(long, 20)
    expect(cut.endsWith("…")).toBe(true)
    expect(cut.length).toBe(20)
  })
})

describe("formatErrorDetails", () => {
  it("omits empty fields and labels the rest", () => {
    expect(
      formatErrorDetails({
        url: "https://foresightmatchmaker.app/me",
        digest: "abc123",
        message: "boom",
      }),
    ).toBe("Page: https://foresightmatchmaker.app/me\nReference: abc123\nMessage: boom")
  })
})

describe("mailtoHref", () => {
  it("encodes subject and body for a clickable compose window", () => {
    const href = mailtoHref("bradley@foresight.org", "Beta: feedback", "What happened:\n\nA crash")
    expect(href.startsWith("mailto:bradley@foresight.org?")).toBe(true)
    expect(href).toContain("subject=Beta%3A%20feedback")
    expect(href).toContain("body=What%20happened")
  })
})
