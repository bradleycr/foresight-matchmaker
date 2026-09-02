import { describe, expect, it } from "vitest"
import { profilePageUrl } from "./profile-url"

describe("profilePageUrl", () => {
  it("builds a profile path on the public origin", () => {
    expect(profilePageUrl("https://foresightmatchmaker.app", "helix-vision-labs")).toBe(
      "https://foresightmatchmaker.app/profile/helix-vision-labs",
    )
  })

  it("strips a trailing slash from the origin", () => {
    expect(profilePageUrl("https://foresightmatchmaker.app/", "acme")).toBe(
      "https://foresightmatchmaker.app/profile/acme",
    )
  })
})
