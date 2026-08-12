import { describe, expect, it } from "vitest"
import {
  EXAMPLE_AI_ABOUT,
  EXAMPLE_AI_PROPOSAL,
  matchesExampleAiAbout,
  proposalIsSubstantial,
} from "./example-about"
import { proposeProfile } from "./prefill"

describe("example About → proposal", () => {
  it("recognises the Meridian fixture text", () => {
    expect(matchesExampleAiAbout(EXAMPLE_AI_ABOUT)).toBe(true)
    expect(matchesExampleAiAbout("unrelated lab")).toBe(false)
  })

  it("proposeProfile returns the hand-authored Meridian proposal without calling an LLM", async () => {
    const proposal = await proposeProfile(EXAMPLE_AI_ABOUT)
    expect(proposal).toEqual(EXAMPLE_AI_PROPOSAL)
    expect(proposalIsSubstantial(proposal)).toBe(true)
    expect(proposal?.org_name).toBe("Meridian Vision Lab")
    expect(proposal?.methods).toContain("computer_vision")
    expect(proposal?.data_needs?.modality).toContain("imaging_histopath")
  })

  it("still matches when the user trims or lightly edits whitespace", async () => {
    const messy = `\n\n${EXAMPLE_AI_ABOUT.replace(/\n\n/g, "\n")}\n`
    const proposal = await proposeProfile(messy)
    expect(proposal?.org_name).toBe("Meridian Vision Lab")
    expect(proposal?.country).toBe("DE")
  })
})
