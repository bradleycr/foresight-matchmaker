import type { Profile, Dataset, DataNeeds } from "@rmm/schema"

/**
 * Schema-true builders for tests. Every default below is a real value from
 * the @rmm/schema enums — no casts, no invented vocabulary — so a fixture
 * that compiles is also a fixture that validates.
 */

let counter = 0
function uuid(): string {
  counter++
  const n = counter.toString(16).padStart(12, "0")
  return `00000000-0000-4000-8000-${n}`
}

const NOW = "2026-01-01T00:00:00.000Z"

export function buildDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    name: "Test cohort",
    modality: ["imaging_mri"],
    disease_area: ["neurology"],
    n_subjects: "10k_100k",
    volume: "1_10tb",
    longitudinal: true,
    annotation: "expert_labelled",
    linkage: ["genomics"],
    standards: ["dicom"],
    readiness: "ai_ready",
    consent_basis: "broad_consent",
    access_model: "dua_required",
    data_can_leave_institution: "yes",
    ethics_approval: "approved",
    publicly_describable: true,
    ...overrides,
  }
}

export function buildNeeds(overrides: Partial<DataNeeds> = {}): DataNeeds {
  return {
    modality: ["imaging_mri"],
    disease_area: ["neurology"],
    min_n_subjects: "1k_10k",
    annotation_required: "expert_labelled",
    linkage_required: ["genomics"],
    standards_preferred: ["dicom"],
    ...overrides,
  }
}

const shared = () => ({
  id: uuid(),
  slug: `org-${counter}`,
  org_name: `Org ${counter}`,
  org_type: "university" as const,
  country: "DE",
  eligible_hq: true,
  partner_only: false,
  one_liner: "A test organisation.",
  summary: "Summary.",
  languages: ["en" as const],
  looking_for: ["ai_partner" as const],
  application_status: "intend_to_apply" as const,
  parallel_public_funding: "no" as const,
  attending: ["webinar_2026_08_20" as const],
  open_to_intros: true,
  visibility: "public" as const,
  contact_name: "Alex Doe",
  contact_email: "alex@example.org",
  contact_role: "PI",
  created_at: NOW,
  updated_at: NOW,
  completeness: 80,
})

const aiFields = () => ({
  methods: ["computer_vision" as const],
  application_target: ["diagnostics" as const],
  domain_expertise: ["neurology" as const],
  clinical_partner: "have" as const,
  regulatory_experience: ["gdpr_dpia" as const],
  compute: "own_cluster" as const,
  privacy_capability: ["can_work_in_tre" as const, "federated_capable" as const],
  team_size: "6_15" as const,
  track_record: [] as string[],
  data_needs: buildNeeds(),
})

type DataHolder = Extract<Profile, { kind: "data_holder" }>
type AiTeam = Extract<Profile, { kind: "ai_team" }>
type Consortium = Extract<Profile, { kind: "consortium" }>

export function buildDataHolder(overrides: Partial<DataHolder> = {}): DataHolder {
  return {
    ...shared(),
    kind: "data_holder",
    datasets: [buildDataset()],
    ...overrides,
  }
}

export function buildAiTeam(overrides: Partial<AiTeam> = {}): AiTeam {
  return {
    ...shared(),
    kind: "ai_team",
    ...aiFields(),
    ...overrides,
  }
}

export function buildConsortium(overrides: Partial<Consortium> = {}): Consortium {
  return {
    ...shared(),
    kind: "consortium",
    datasets: [buildDataset()],
    ...aiFields(),
    still_seeking: ["clinical_partner" as const],
    ...overrides,
  }
}
