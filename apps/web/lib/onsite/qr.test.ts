import { describe, expect, it } from "vitest"
import { qrSvgMarkup } from "./qr"

describe("qrSvgMarkup", () => {
  it("renders an SVG for the join URL", () => {
    const svg = qrSvgMarkup("https://foresightmatchmaker.app/here/berlin")
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain("currentColor")
    expect(svg).toContain("viewBox")
  })
})
