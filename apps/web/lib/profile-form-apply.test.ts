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
    org_type_other: "",
    country: "DE",
    one_liner: "",
    summary: "",
    website: "",
    languages: [],
    looking_for: [],
    looking_for_other: "",
    attending: [],
    application_status: "undecided",
    affiliation: "",
    methods: [],
    methods_other: "",
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
    compute_scale: "",
    intended_public_contribution: "",
    funding_mainly_needed_for: "",
    best_public_dataset: "",
  }
}

function proposal(partial: Partial<PrefillProposal>): PrefillProposal {
  return {
    languages: [],
    looking_for: [],
    still_seeking: [],
    attending: [],
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

  it("applies event chips onto attending", () => {
    const next = mergeProposalIntoForm(
      blankTarget(),
      proposal({ attending: ["event_sept_1", "remote_only"] }),
      COUNTRIES,
    )
    expect(next.attending).toEqual(["event_sept_1", "remote_only"])
  })

  it("keeps an individual as a person even if the extractor guessed a hospital org type", () => {
    const next = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "individual",
        org_name: "Bradley Royes",
        org_type: "hospital",
        affiliation: "Charité",
        application_status: "intend_to_apply",
      }),
      COUNTRIES,
    )
    expect(next.kind).toBe("individual")
    expect(next.org_type).toBe("individual")
    expect(next.team_size).toBe("1")
    expect(next.affiliation).toBe("Charité")
    expect(next.application_status).toBe("intend_to_apply")
  })

  it("applies what a consortium is still seeking", () => {
    const next = mergeProposalIntoForm(
      { ...blankTarget(), kind: "consortium" },
      proposal({ still_seeking: ["ai_partner", "compute"] }),
      COUNTRIES,
    )
    expect(next.still_seeking).toEqual(["ai_partner", "compute"])
  })

  it("does not keep org_type individual on a data holder", () => {
    const next = mergeProposalIntoForm(
      { ...blankTarget(), kind: "individual", org_type: "individual", team_size: "1" },
      proposal({ kind: "data_holder", org_name: "Charité" }),
      COUNTRIES,
    )
    expect(next.kind).toBe("data_holder")
    expect(next.org_type).toBe("hospital")
  })

  it("lets a later named dataset paste fill scale without wiping modality already on the form", () => {
    const started = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "data_holder",
        datasets: [{ name: "Berlin MRI", modality: ["imaging_mri"], disease_area: ["oncology"], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )
    const next = mergeProposalIntoForm(
      started,
      proposal({
        datasets: [
          {
            name: "Berlin MRI",
            modality: [],
            disease_area: [],
            n_subjects: "10k_100k",
            volume: "1_10tb",
            access_model: "dua_required",
            linkage: ["outcomes"],
            standards: ["dicom"],
          },
        ],
      }),
      COUNTRIES,
    )
    expect(next.datasets).toHaveLength(1)
    expect(next.datasets[0]?.modality).toEqual(["imaging_mri"])
    expect(next.datasets[0]?.disease_area).toEqual(["oncology"])
    expect(next.datasets[0]?.n_subjects).toBe("10k_100k")
    expect(next.datasets[0]?.access_model).toBe("dua_required")
  })

  it("applies a free-text Other method", () => {
    const next = mergeProposalIntoForm(
      { ...blankTarget(), kind: "ai_team" },
      proposal({ methods: ["other"], methods_other: "Mechanistic ODE models" }),
      COUNTRIES,
    )
    expect(next.methods).toEqual(["other"])
    expect(next.methods_other).toBe("Mechanistic ODE models")
  })

  it("adds methods Other when the extractor only returned a definition", () => {
    const next = mergeProposalIntoForm(
      { ...blankTarget(), kind: "ai_team", methods: ["clinical_nlp"] },
      proposal({ methods_other: "Mechanistic ODE models" }),
      COUNTRIES,
    )
    expect(next.methods).toEqual(["clinical_nlp", "other"])
    expect(next.methods_other).toBe("Mechanistic ODE models")
  })

  it("adds looking-for Other when the extractor only returned a definition", () => {
    const next = mergeProposalIntoForm(
      blankTarget(),
      proposal({ looking_for_other: "A federated compute partner" }),
      COUNTRIES,
    )
    expect(next.looking_for).toEqual(["other"])
    expect(next.looking_for_other).toBe("A federated compute partner")
  })

  it("folds a later named dataset into the one already started, even when names differ", () => {
    const started = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "data_holder",
        datasets: [{ name: "Berlin MRI", modality: ["imaging_mri"], disease_area: ["oncology"], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )
    const next = mergeProposalIntoForm(
      started,
      proposal({
        datasets: [
          {
            name: "Oncology imaging cohort",
            modality: [],
            disease_area: [],
            n_subjects: "10k_100k",
            access_model: "dua_required",
            linkage: [],
            standards: [],
          },
        ],
      }),
      COUNTRIES,
    )
    expect(next.datasets).toHaveLength(1)
    expect(next.datasets[0]?.name).toBe("Berlin MRI")
    expect(next.datasets[0]?.modality).toEqual(["imaging_mri"])
    expect(next.datasets[0]?.disease_area).toEqual(["oncology"])
    expect(next.datasets[0]?.n_subjects).toBe("10k_100k")
    expect(next.datasets[0]?.access_model).toBe("dua_required")
  })

  it("does not reset scale to empty-dataset defaults on a later named overlay", () => {
    const started = mergeProposalIntoForm(
      blankTarget(),
      proposal({
        kind: "data_holder",
        datasets: [
          {
            name: "Berlin MRI",
            modality: ["imaging_mri"],
            disease_area: ["oncology"],
            n_subjects: "10k_100k",
            volume: "1_10tb",
            access_model: "dua_required",
            linkage: ["outcomes"],
            standards: ["dicom"],
          },
        ],
      }),
      COUNTRIES,
    )
    const next = mergeProposalIntoForm(
      started,
      proposal({
        datasets: [{ name: "Berlin MRI", modality: [], disease_area: [], linkage: [], standards: [] }],
      }),
      COUNTRIES,
    )
    expect(next.datasets).toHaveLength(1)
    expect(next.datasets[0]?.n_subjects).toBe("10k_100k")
    expect(next.datasets[0]?.volume).toBe("1_10tb")
    expect(next.datasets[0]?.access_model).toBe("dua_required")
    expect(next.datasets[0]?.linkage).toEqual(["outcomes"])
  })
})
