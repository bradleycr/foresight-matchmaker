import { describe, expect, it } from "vitest"
import { findManualGaps, type GapInspectable } from "./profile-form-gaps"

function blank(kind: GapInspectable["kind"]): GapInspectable {
  return {
    kind,
    org_name: "Ada Lovelace",
    one_liner: "Independent ML researcher.",
    summary: "Works on clinical NLP.",
    website: "https://example.org",
    languages: ["en"],
    looking_for: ["join_team"],
    attending: ["event_sept_1"],
    contact_name: "Ada",
    contact_email: "ada@example.org",
    methods: ["clinical_nlp"],
    application_target: ["diagnostics"],
    domain_expertise: ["oncology"],
    privacy_capability: ["can_work_in_tre"],
    needs_modality: [],
    needs_disease_area: [],
    needs_min_n_subjects: "",
    needs_annotation: "",
    compute_scale: "",
    datasets: [],
    methods_other: "",
  }
}

describe("findManualGaps", () => {
  it("does not treat data-needs as blocking for an independent expert", () => {
    expect(findManualGaps(blank("individual"))).toEqual([])
  })

  it("does not treat an empty clinical domain as blocking for an AI team", () => {
    const team = blank("ai_team")
    team.domain_expertise = []
    expect(findManualGaps(team)).toEqual([])
  })

  it("does not treat data-needs as blocking for an AI team", () => {
    expect(findManualGaps(blank("ai_team"))).toEqual([])
  })

  it("still flags an empty dataset listing for a data holder", () => {
    const holder = blank("data_holder")
    holder.datasets = [{ name: "", modality: [], disease_area: [] }]
    expect(findManualGaps(holder)).toContain("datasets")
  })

  it("flags a consortium that has not said what it is still seeking", () => {
    expect(findManualGaps(blank("consortium"))).toContain("still_seeking")
  })

  it("flags methods Other until they define it", () => {
    const team = blank("ai_team")
    team.methods = ["other"]
    team.methods_other = ""
    expect(findManualGaps(team)).toContain("methods_other")
  })

  it("flags looking-for Other until they define it", () => {
    const team = blank("ai_team")
    team.looking_for = ["other"]
    team.looking_for_other = ""
    expect(findManualGaps(team)).toContain("looking_for_other")
  })

  it("flags consortium still-seeking Other until they define it", () => {
    const consortium = blank("consortium")
    consortium.still_seeking = ["other"]
    consortium.looking_for_other = ""
    consortium.datasets = [{ name: "Cohort", modality: ["ehr_structured"], disease_area: ["oncology"], n_subjects: "1k_10k", access_model: "dua_required" }]
    expect(findManualGaps(consortium)).toContain("looking_for_other")
  })
})
