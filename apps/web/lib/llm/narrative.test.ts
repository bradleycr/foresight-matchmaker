import { describe, expect, it } from "vitest"
import { inventedNumbers, sanitizeNarrative } from "./narrative"

describe("sanitizeNarrative", () => {
  const source = "Charité oncology MRI cohort 40k subjects, TRE access only, looking for an AI partner."

  it("accepts institutional copy that stays inside the source facts", () => {
    const clean = sanitizeNarrative(
      {
        one_liner: "Oncology MRI cohort, 40k subjects, TRE-only access.",
        summary:
          "Charité holds an oncology MRI cohort of 40k subjects. TRE access only. Looking for an AI partner.",
      },
      source,
    )
    expect(clean?.one_liner).toMatch(/40k/)
    expect(clean?.summary).toMatch(/Charité/)
  })

  it("rejects hype words", () => {
    expect(
      sanitizeNarrative(
        {
          one_liner: "Leading innovative oncology MRI platform.",
          summary: "We are a cutting-edge team passionate about health data and AI.",
        },
        source,
      ),
    ).toBeNull()
  })

  it("rejects numbers that were not in the source", () => {
    expect(
      sanitizeNarrative(
        {
          one_liner: "Oncology MRI cohort, 250k subjects.",
          summary: "A large imaging bank with 250k labelled cases and TRE access.",
        },
        source,
      ),
    ).toBeNull()
  })

  it("rejects copy that is too thin", () => {
    expect(sanitizeNarrative({ one_liner: "Hi", summary: "Too short." }, source)).toBeNull()
  })
})

describe("inventedNumbers", () => {
  it("allows numbers that already appear in the source", () => {
    expect(inventedNumbers("40k subjects", "cohort of 40k")).toEqual([])
  })

  it("flags a count the source never mentioned", () => {
    expect(inventedNumbers("90k patients", "oncology MRI cohort")).toEqual(["90"])
  })
})
