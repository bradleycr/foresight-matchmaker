import { z } from "zod"

/**
 * Controlled vocabularies for Foresight Matchmaking.
 *
 * Recoding Medicine is the first programme; its fields live here until a
 * second challenge needs a variant. Adding a value is backwards compatible;
 * removing or renaming one is a breaking change and requires a schema
 * version bump. Order is meaningful for the "bucketed" enums (n_subjects,
 * volume, team_size — scale scoring depends on ordinal position).
 */

// ---------------------------------------------------------------------------
// Shared profile vocabularies
// ---------------------------------------------------------------------------

export const KIND = ["data_holder", "ai_team", "consortium", "individual"] as const
export const kindEnum = z.enum(KIND)
export type Kind = (typeof KIND)[number]

/** Kinds that carry datasets and can occupy the data side of a pairing. */
export function hasDatasetKind(kind: Kind): boolean {
  return kind === "data_holder" || kind === "consortium"
}

/** Kinds that carry AI capability and can occupy the AI side of a data pairing. */
export function hasAiCapabilityKind(kind: Kind): boolean {
  return kind === "ai_team" || kind === "consortium"
}

/**
 * Which programme a profile is listed for. The platform is Foresight
 * Matchmaking; each challenge carries its own schema flavour, copy, and
 * matching rules. Adding an id is backwards compatible.
 */
export const CHALLENGE_ID = ["recoding_medicine"] as const
export const challengeIdEnum = z.enum(CHALLENGE_ID)
export type ChallengeId = (typeof CHALLENGE_ID)[number]
export const DEFAULT_CHALLENGE_ID: ChallengeId = "recoding_medicine"

export const ORG_TYPE = [
  "university",
  "research_institute",
  "hospital",
  "biobank_or_registry",
  "company",
  "startup",
  "incubator",
  "individual",
  "other",
] as const
export const orgTypeEnum = z.enum(ORG_TYPE)
export type OrgType = (typeof ORG_TYPE)[number]

export const LANGUAGE = [
  "en",
  "de",
  "fr",
  "nl",
  "es",
  "it",
  "pl",
  "sv",
  "da",
  // Eligible-region languages that were missing from the first cut — Israel
  // (he), plus the rest of the EU set the golden fixtures asked us to cover.
  "he",
  "fi",
  "pt",
  "el",
  "cs",
  "hu",
  "ro",
  "other",
] as const
export const languageEnum = z.enum(LANGUAGE)
export type Language = (typeof LANGUAGE)[number]

export const LOOKING_FOR = [
  "dataset_access",
  "ai_partner",
  "clinical_partner",
  "data_governance_support",
  "compute",
  "join_team",
  "individual_expert",
  "not_looking",
  "other",
] as const
export const lookingForEnum = z.enum(LOOKING_FOR)
export type LookingFor = (typeof LOOKING_FOR)[number]

export const APPLICATION_STATUS = [
  "undecided",
  "intend_to_apply",
  "applying_with_partner",
  "team_complete",
  "not_applying",
] as const
export const applicationStatusEnum = z.enum(APPLICATION_STATUS)
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number]

export const YES_NO_UNSURE = ["yes", "no", "unsure"] as const
export const yesNoUnsureEnum = z.enum(YES_NO_UNSURE)
export type YesNoUnsure = (typeof YES_NO_UNSURE)[number]

export const ATTENDING = [
  "webinar_2026_08_20",
  "event_sept_1",
  "event_sept_2",
  "event_sept_3",
  "remote_only",
] as const
export const attendingEnum = z.enum(ATTENDING)
export type Attending = (typeof ATTENDING)[number]

/**
 * Kept on stored profiles so existing rows still parse. The webinar has
 * already happened — listings are created after it, so the form never
 * offers this chip.
 */
export const WEBINAR_ATTENDING: Attending = "webinar_2026_08_20"

export function isWebinarOpen(_now = new Date()): boolean {
  return false
}

/** In-person / remote chips for the form — webinar is not offered. */
export function attendingChoices(_now = new Date()): Attending[] {
  return ATTENDING.filter((v) => v !== WEBINAR_ATTENDING)
}

export const VISIBILITY = ["authenticated_only", "public", "hidden"] as const
export const visibilityEnum = z.enum(VISIBILITY)
export type Visibility = (typeof VISIBILITY)[number]

// ---------------------------------------------------------------------------
// Dataset vocabularies
// ---------------------------------------------------------------------------

export const MODALITY = [
  "imaging_mri",
  "imaging_ct",
  "imaging_xray",
  "imaging_histopath",
  "imaging_other",
  "genomics",
  "transcriptomics",
  "proteomics",
  "metabolomics",
  "epigenomics",
  "microbiome",
  "spatial_omics",
  "multi_omics",
  "ehr_structured",
  "clinical_notes",
  "registry",
  "cohort_longitudinal",
  "waveform_ecg_eeg",
  "wearable_sensor",
  "claims",
  "biospecimens",
  "patient_reported_outcomes",
  "voice_data",
  "other",
] as const
export const modalityEnum = z.enum(MODALITY)
export type Modality = (typeof MODALITY)[number]

/** Imaging modalities are grouped so cross-imaging pairs earn partial credit. */
export const IMAGING_MODALITIES: readonly Modality[] = [
  "imaging_mri",
  "imaging_ct",
  "imaging_xray",
  "imaging_histopath",
  "imaging_other",
]

export const DISEASE_AREA = [
  "oncology",
  "cardiovascular",
  "neurology",
  "psychiatry",
  "rare_disease",
  "infectious",
  "metabolic_endocrine",
  "respiratory",
  "musculoskeletal",
  "womens_health",
  "paediatrics",
  "geriatrics",
  "immunology",
  "dermatology",
  "ophthalmology",
  "critical_care",
  "dentistry",
  "multi_domain",
  "other",
] as const
export const diseaseAreaEnum = z.enum(DISEASE_AREA)
export type DiseaseArea = (typeof DISEASE_AREA)[number]

/** Ordinal — index position is used for scale scoring. */
export const N_SUBJECTS = ["lt_1k", "1k_10k", "10k_100k", "100k_1m", "gt_1m"] as const
export const nSubjectsEnum = z.enum(N_SUBJECTS)
export type NSubjects = (typeof N_SUBJECTS)[number]

/** Ordinal. */
export const VOLUME = ["lt_100gb", "100gb_1tb", "1_10tb", "10_100tb", "gt_100tb"] as const
export const volumeEnum = z.enum(VOLUME)
export type Volume = (typeof VOLUME)[number]

export const ANNOTATION = ["none", "partial", "expert_labelled", "outcome_linked"] as const
export const annotationEnum = z.enum(ANNOTATION)
export type Annotation = (typeof ANNOTATION)[number]

export const LINKAGE = ["outcomes", "mortality", "genomics", "imaging", "medication", "none"] as const
export const linkageEnum = z.enum(LINKAGE)
export type Linkage = (typeof LINKAGE)[number]

export const STANDARDS = [
  "dicom",
  "fhir",
  "omop_cdm",
  "bids",
  "vcf",
  "hl7v2",
  "snomed",
  "proprietary",
  "none",
] as const
export const standardsEnum = z.enum(STANDARDS)
export type Standards = (typeof STANDARDS)[number]

export const READINESS = ["raw", "partially_curated", "ai_ready", "benchmark_ready"] as const
export const readinessEnum = z.enum(READINESS)
export type Readiness = (typeof READINESS)[number]

export const CONSENT_BASIS = [
  "broad_consent",
  "study_specific_consent",
  "public_task_art6_1e",
  "research_art9_2j",
  "fully_anonymised",
  "pseudonymised",
  "unclear",
] as const
export const consentBasisEnum = z.enum(CONSENT_BASIS)
export type ConsentBasis = (typeof CONSENT_BASIS)[number]

export const ACCESS_MODEL = [
  "open_download",
  "registered_access",
  "dua_required",
  "secure_processing_environment_only",
  "federated_no_movement",
  "synthetic_derivative_only",
  "undecided",
] as const
export const accessModelEnum = z.enum(ACCESS_MODEL)
export type AccessModel = (typeof ACCESS_MODEL)[number]

export const ETHICS_APPROVAL = ["approved", "in_progress", "not_started", "not_required"] as const
export const ethicsApprovalEnum = z.enum(ETHICS_APPROVAL)
export type EthicsApproval = (typeof ETHICS_APPROVAL)[number]

// ---------------------------------------------------------------------------
// AI team vocabularies
// ---------------------------------------------------------------------------

export const METHODS = [
  "foundation_models",
  "computer_vision",
  "clinical_nlp",
  "multimodal",
  "graph_knowledge",
  "causal_inference",
  "survival_longitudinal",
  "synthetic_data",
  "federated_learning",
  "privacy_tech",
  "classical_ml_biostat",
  "other",
] as const
export const methodsEnum = z.enum(METHODS)
export type Methods = (typeof METHODS)[number]

export const APPLICATION_TARGET = [
  "biomarker_discovery",
  "diagnostics",
  "clinical_decision_support",
  "drug_repurposing",
  "prognosis_risk",
  "triage_workflow",
  "trial_design",
  "other",
] as const
export const applicationTargetEnum = z.enum(APPLICATION_TARGET)
export type ApplicationTarget = (typeof APPLICATION_TARGET)[number]

export const CLINICAL_PARTNER = ["have", "need", "not_needed"] as const
export const clinicalPartnerEnum = z.enum(CLINICAL_PARTNER)
export type ClinicalPartner = (typeof CLINICAL_PARTNER)[number]

export const REGULATORY_EXPERIENCE = ["mdr", "ivdr", "ce_marking", "gdpr_dpia", "none"] as const
export const regulatoryExperienceEnum = z.enum(REGULATORY_EXPERIENCE)
export type RegulatoryExperience = (typeof REGULATORY_EXPERIENCE)[number]

export const COMPUTE = ["own_cluster", "cloud_budget", "need_compute", "unsure"] as const
export const computeEnum = z.enum(COMPUTE)
export type Compute = (typeof COMPUTE)[number]

/**
 * The single most consequential field in the schema. Access-model
 * compatibility between a dataset's constraints and a team's privacy
 * capability decides eligibility more often than any other factor.
 */
export const PRIVACY_CAPABILITY = [
  "can_work_in_tre",
  "federated_capable",
  "differential_privacy",
  "on_prem_only",
  "requires_data_export",
  "synthetic_only",
] as const
export const privacyCapabilityEnum = z.enum(PRIVACY_CAPABILITY)
export type PrivacyCapability = (typeof PRIVACY_CAPABILITY)[number]

/** Ordinal. */
export const TEAM_SIZE = ["1", "2_5", "6_15", "gt_15"] as const
export const teamSizeEnum = z.enum(TEAM_SIZE)
export type TeamSize = (typeof TEAM_SIZE)[number]

// ---------------------------------------------------------------------------
// Intro-flow vocabularies
// ---------------------------------------------------------------------------

export const INTRO_STATE = ["requested", "accepted", "declined", "expired", "emailed"] as const
export const introStateEnum = z.enum(INTRO_STATE)
export type IntroState = (typeof INTRO_STATE)[number]

export const DECLINE_REASON = [
  "wrong_domain",
  "governance_mismatch",
  "already_have_partner",
  "not_applying",
  "other",
] as const
export const declineReasonEnum = z.enum(DECLINE_REASON)
export type DeclineReason = (typeof DECLINE_REASON)[number]

export const JOINT_APPLICATION_OUTCOME = ["yes", "no", "not_yet"] as const
export const jointApplicationOutcomeEnum = z.enum(JOINT_APPLICATION_OUTCOME)
export type JointApplicationOutcome = (typeof JOINT_APPLICATION_OUTCOME)[number]

// ---------------------------------------------------------------------------
// Ordinal helpers (used by the matching package for graded scoring)
// ---------------------------------------------------------------------------

/** Rank of an n_subjects bucket, 0-based. Higher = more subjects. */
export function nSubjectsRank(v: NSubjects): number {
  return N_SUBJECTS.indexOf(v)
}

/** Rank of a team_size bucket, 0-based. Higher = larger team. */
export function teamSizeRank(v: TeamSize): number {
  return TEAM_SIZE.indexOf(v)
}
