import { describe, expect, it } from "vitest"
import { proposalFromAsk, resolveAsk } from "./ask"

describe("resolveAsk", () => {
  it("keeps a valid model ask", () => {
    expect(resolveAsk("methods", ["org_name"], null)).toBe("methods")
  })

  it("does not chip a free-text gap", () => {
    expect(resolveAsk(undefined, ["org_name", "methods"], null)).toBeNull()
  })

  it("infers methods once identity is filled", () => {
    expect(resolveAsk(undefined, ["methods", "application_target"], null)).toBe("methods")
  })

  it("asks disease area after a dataset already has modality", () => {
    expect(
      resolveAsk("whatever", ["datasets"], {
        datasets: [{ name: "Berlin MRI", modality: ["imaging_mri"], disease_area: [] }],
      }),
    ).toBe("disease_area")
  })
})

describe("proposalFromAsk", () => {
  it("maps disease chips to domain expertise for AI kinds", () => {
    const p = proposalFromAsk("domain_expertise", ["oncology", "neurology"], "ai_team")
    expect(p.domain_expertise).toEqual(["oncology", "neurology"])
    expect(p.data_needs).toBeUndefined()
  })

  it("maps modality chips onto a dataset for data holders", () => {
    const p = proposalFromAsk("modality", ["imaging_mri", "genomics"], "data_holder")
    expect(p.datasets?.[0]?.modality).toEqual(["imaging_mri", "genomics"])
  })

  it("maps optional modality chips onto data_needs for an individual", () => {
    const p = proposalFromAsk("modality", ["ehr_structured"], "individual")
    expect(p.data_needs?.modality).toEqual(["ehr_structured"])
    expect(p.datasets).toEqual([])
  })
})
