import { describe, expect, it } from "vitest"
import { emptyDataset } from "@/components/profile-form/dataset-editor"
import { mergeProposalIntoForm, type ProposalMergeTarget } from "./profile-form-apply"
import type { PrefillProposal } from "@/lib/llm/prefill"

const COUNTRIES = ["DE", "FR", "NL"] as const

function blankTarget(): ProposalMergeTarget {
  return {
    kind: "data_holder",
    org_name: "",
    org_type: "hospital",
    country: "DE",
    one_liner: "",
    summary: "",
    website: "",
    languages: [],
    looking_for: [],
    methods: [],
    application_target: [],
    domain_expertise: [],
    clinical_partner: "need",
    regulatory_experience: [],
    compute: "unsure",
    privacy_capability: [],
    team_size: "2_5",
    track_record: "",
    needs_modality: [],
    needs_disease_area: [],
    needs_min_n_subjects: "",
    needs_annotation: "",
    needs_linkage: [],
    needs_standards: [],
    datasets: [emptyDataset()],
    still_seeking: [],
  }
}

function proposal(partial: Partial<PrefillProposal>): PrefillProposal {
  return {
    languages: [],
    looking_for: [],
    methods: [],
    application_target: [],
    domain_expertise: [],
    regulatory_experience: [],
    privacy_capability: [],
    track_record: [],
    datasets: [],
    ...partial,
  }
}

describe("mergeProposalIntoForm", () => {
  it("keeps a named data-holder dataset even when modality is still open", () => {
    const next = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "data_holder",
        org_name: "Charité",
        datasets: [{ name: "Oncology imaging cohort", modality: [], disease_area: [], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )

    expect(next.datasets).toHaveLength(1)
    expect(next.datasets[0]?.name).toBe("Oncology imaging cohort")
    expect(next.datasets[0]?.modality).toEqual([])
  })

  it("applies complete datasets as before", () => {
    const next = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "data_holder",
        datasets: [
          {
            name: "UKB subset",
            modality: ["ehr_structured"],
            disease_area: ["oncology"],
            linkage: [],
            standards: [],
          },
        ],
      }),
      COUNTRIES,
    )

    expect(next.datasets[0]?.name).toBe("UKB subset")
    expect(next.datasets[0]?.modality).toEqual(["ehr_structured"])
    expect(next.datasets[0]?.disease_area).toEqual(["oncology"])
  })

  it("fills missing tags on a later Remmy turn without wiping what the human typed", () => {
    const started = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "data_holder",
        datasets: [{ name: "Berlin MRI", modality: ["imaging_mri"], disease_area: [], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )

    const next = mergeProposalIntoForm(
      started,
      proposal({
        datasets: [{ name: "Berlin MRI", modality: [], disease_area: ["neurology"], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )

    expect(next.datasets).toHaveLength(1)
    expect(next.datasets[0]?.name).toBe("Berlin MRI")
    expect(next.datasets[0]?.modality).toEqual(["imaging_mri"])
    expect(next.datasets[0]?.disease_area).toEqual(["neurology"])
  })

  it("folds nameless modality then disease chips into one dataset row", () => {
    const afterModality = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "data_holder",
        datasets: [{ name: "", modality: ["imaging_mri"], disease_area: [], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )
    const next = mergeProposalIntoForm(
      afterModality,
      proposal({
        datasets: [{ name: "", modality: [], disease_area: ["oncology"], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )

    expect(next.datasets).toHaveLength(1)
    expect(next.datasets[0]?.modality).toEqual(["imaging_mri"])
    expect(next.datasets[0]?.disease_area).toEqual(["oncology"])
  })
})
