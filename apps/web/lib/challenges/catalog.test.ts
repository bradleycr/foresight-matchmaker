import { describe, expect, it } from "vitest"
import { browseDirectoryPath, directoryHref } from "./catalog"

describe("browseDirectoryPath", () => {
  it("sends a Recoding Medicine listing to that programme directory", () => {
    expect(browseDirectoryPath("recoding_medicine")).toBe("/directory?challenge=recoding_medicine")
  })

  it("falls back to the only open programme when there is no listing yet", () => {
    expect(browseDirectoryPath(null)).toBe("/directory?challenge=recoding_medicine")
    expect(browseDirectoryPath(undefined)).toBe(directoryHref("recoding_medicine"))
  })
})
