import type { Profile, Dataset, DataNeeds } from "@rmm/schema"

/**
 * Minimal valid builders for tests. These produce schema-shaped objects with
 * sensible defaults; each test overrides only the fields it cares about.
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
    n_subjects: "1k_10k",
    volume: "tb_1_10",
    longitudinal: true,
    annotation: "expert_labeled",
    linkage: ["genomics"],
    standards: ["dicom"],
    readiness: "ready_now",
    consent_basis: "broad_consent",
    access_model: "data_transfer_allowed",
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
    annotation_required: "expert_labeled",
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
  one_liner: "A test organisation.",
  summary: "Summary.",
  languages: ["en" as const],
  looking_for: [] as [],
  application_status: "exploring" as const,
  parallel_public_funding: "no" as const,
  attending: [] as [],
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
  methods: ["deep_learning" as const],
  application_target: ["diagnosis" as const],
  domain_expertise: ["neurology" as const],
  clinical_partner: "have" as const,
  regulatory_experience: [] as [],
  compute: "cloud" as const,
  privacy_capability: ["can_work_in_tre" as const, "federated_capable" as const],
  team_size: "s_2_5" as const,
  track_record: [] as [],
  data_needs: buildNeeds(),
})

export function buildDataHolder(overrides: Partial<Profile> = {}): Profile {
  return {
    ...shared(),
    kind: "data_holder",
    datasets: [buildDataset()],
    ...overrides,
  } as Profile
}

export function buildAiTeam(overrides: Partial<Profile> = {}): Profile {
  return {
    ...shared(),
    kind: "ai_team",
    ...aiFields(),
    ...overrides,
  } as Profile
}

export function buildConsortium(overrides: Partial<Profile> = {}): Profile {
  return {
    ...shared(),
    kind: "consortium",
    datasets: [buildDataset()],
    ...aiFields(),
    still_seeking: ["data" as const],
    ...overrides,
  } as Profile
}
