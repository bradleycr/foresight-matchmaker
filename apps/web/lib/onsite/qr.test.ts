import { describe, expect, it } from "vitest"
import { qrSvgMarkup } from "./qr"

describe("qrSvgMarkup", () => {
  it("renders an SVG for the join URL", () => {
    const svg = qrSvgMarkup("https://foresightmatchmaker.app/here/berlin")
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain("currentColor")
    expect(svg).toContain("viewBox")
  })

  it("supports a tighter quiet zone for tile QRs", () => {
    const large = qrSvgMarkup("https://example.test/a")
    const compact = qrSvgMarkup("https://example.test/a", { border: 1 })
    expect(compact).not.toEqual(large)
  })
})
