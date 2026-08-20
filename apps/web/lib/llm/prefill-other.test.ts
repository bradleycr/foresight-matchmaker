import { describe, expect, it } from "vitest"
import { coerceUnknownOtherFields, prefillProposalSchema } from "./prefill"

describe("coerceUnknownOtherFields", () => {
  it("keeps an unknown method as Other plus the person's words", () => {
    const coerced = coerceUnknownOtherFields({
      methods: ["clinical_nlp", "mechanistic ODE models"],
    })
    const parsed = prefillProposalSchema.parse(coerced)
    expect(parsed.methods).toEqual(["clinical_nlp", "other"])
    expect(parsed.methods_other).toBe("mechanistic ODE models")
  })

  it("keeps an unknown looking-for as Other plus the person's words", () => {
    const parsed = prefillProposalSchema.parse(
      coerceUnknownOtherFields({ looking_for: ["a federated compute partner"] }),
    )
    expect(parsed.looking_for).toEqual(["other"])
    expect(parsed.looking_for_other).toBe("a federated compute partner")
  })

  it("keeps an unknown organisation type as Other plus the person's words", () => {
    const parsed = prefillProposalSchema.parse(
      coerceUnknownOtherFields({ org_type: "patient advocacy network" }),
    )
    expect(parsed.org_type).toBe("other")
    expect(parsed.org_type_other).toBe("patient advocacy network")
  })

  it("does not invent Other when every value is already in the vocabulary", () => {
    const parsed = prefillProposalSchema.parse(
      coerceUnknownOtherFields({ methods: ["clinical_nlp", "multimodal"] }),
    )
    expect(parsed.methods).toEqual(["clinical_nlp", "multimodal"])
    expect(parsed.methods_other).toBeUndefined()
  })
})
