import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { profileSchema, type Profile } from "./profile"
import { applyDerivedFields } from "./derive"
import {
  DISEASE_AREA,
  MODALITY,
  N_SUBJECTS,
  VOLUME,
  ANNOTATION,
  LINKAGE,
  STANDARDS,
  READINESS,
  CONSENT_BASIS,
  ACCESS_MODEL,
  ETHICS_APPROVAL,
  METHODS,
  APPLICATION_TARGET,
  CLINICAL_PARTNER,
  REGULATORY_EXPERIENCE,
  COMPUTE,
  PRIVACY_CAPABILITY,
  TEAM_SIZE,
  ATTENDING,
  APPLICATION_STATUS,
  type Language,
  type DiseaseArea,
} from "./enums"

/**
 * Generate a hand-authored core of richly-described profiles, then extend it
 * with a larger, combinatorially-generated set so the directory reads as an
 * inhabited phone book (~100-120 entries) rather than a thin demo. Every
 * profile — hand-authored or generated — is deterministic: the same input
 * always produces the same output, so the checked-in seed is stable and
 * diffable, and every record is written to /seed.
 *
 * ALL DATA HERE IS FABRICATED. No real organisation, person, dataset, or
 * email address. See /seed/README.md.
 *
 * Run: pnpm --filter @rmm/schema exec tsx src/generate-seed.ts
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_DIR = resolve(__dirname, "../../../seed")

// Deterministic pseudo-timestamps so diffs stay stable.
const NOW = "2026-08-01T09:00:00.000Z"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Stable synthetic v4-format UUID from a kind code (2 chars) and index.
 * Deterministic so the checked-in seed stays diffable.
 */
function fakeUuid(kind: "dh" | "ai" | "co", i: number): string {
  // Hex-safe first block encodes the kind: data holder / ai team / consortium.
  const block: Record<string, string> = { dh: "da7a0000", ai: "a1000000", co: "c0000000" }
  const n = (i + 1).toString(16).padStart(12, "0")
  // xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx  (version 4, variant 8)
  return `${block[kind]}-0000-4000-8000-${n}`
}

// ---------------------------------------------------------------------------
// Data holders (12)
// ---------------------------------------------------------------------------

type Raw = Record<string, unknown>

const dataHolderSeeds: Raw[] = [
  {
    org_name: "Nordhavn University Cancer Imaging Bank",
    org_type: "biobank_or_registry",
    country: "DK",
    one_liner: "Longitudinal MRI/CT oncology cohort with outcome linkage, 40k subjects.",
    summary:
      "A curated oncology imaging bank linking cross-sectional MRI and CT to registry outcomes and mortality. Governed under Danish public-task provisions; available inside a secure processing environment only.",
    website: "https://example.org/nordhavn-cib",
    languages: ["da", "en"],
    looking_for: ["ai_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_1"],
    contact_name: "Fabricated Contact A",
    contact_email: "holder-a@example.invalid",
    contact_role: "Data Protection Officer",
    datasets: [
      {
        name: "Nordhavn Oncology Imaging",
        modality: ["imaging_mri", "imaging_ct"],
        disease_area: ["oncology"],
        n_subjects: "10k_100k",
        volume: "10_100tb",
        time_span_years: 9,
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "mortality"],
        standards: ["dicom", "omop_cdm"],
        readiness: "ai_ready",
        consent_basis: "public_task_art6_1e",
        access_model: "secure_processing_environment_only",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
        governance_notes: "SPE access via institutional DUA; export of derived weights only.",
      },
    ],
  },
  {
    org_name: "Rhône Genomic Registry",
    org_type: "biobank_or_registry",
    country: "FR",
    one_liner: "Whole-genome + transcriptomics rare-disease registry, 12k probands.",
    summary:
      "National rare-disease genomics registry with VCF and expression data, linked to clinical phenotypes. Federated analysis supported; raw data does not leave the institution.",
    languages: ["fr", "en"],
    looking_for: ["ai_partner", "data_governance_support"],
    application_status: "undecided",
    parallel_public_funding: "unsure",
    attending: ["webinar_2026_08_20"],
    contact_name: "Fabricated Contact B",
    contact_email: "holder-b@example.invalid",
    datasets: [
      {
        name: "Rhône Rare Disease Genomes",
        modality: ["genomics", "transcriptomics"],
        disease_area: ["rare_disease", "neurology"],
        n_subjects: "10k_100k",
        volume: "1_10tb",
        longitudinal: false,
        annotation: "expert_labelled",
        linkage: ["genomics", "outcomes"],
        standards: ["vcf", "fhir"],
        readiness: "partially_curated",
        consent_basis: "study_specific_consent",
        access_model: "federated_no_movement",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Tiber Cardiology Outcomes Cohort",
    org_type: "hospital",
    country: "IT",
    one_liner: "ECG waveforms + EHR for 90k cardiology patients, 11-year span.",
    summary:
      "Structured EHR and 12-lead ECG waveforms from a tertiary cardiology centre, linked to medication and mortality. DUA-based access; anonymised extracts can leave under agreement.",
    languages: ["it", "en"],
    looking_for: ["ai_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["event_sept_2", "remote_only"],
    contact_name: "Fabricated Contact C",
    contact_email: "holder-c@example.invalid",
    datasets: [
      {
        name: "Tiber CV Waveform + EHR",
        modality: ["waveform_ecg_eeg", "ehr_structured"],
        disease_area: ["cardiovascular"],
        n_subjects: "10k_100k",
        volume: "1_10tb",
        time_span_years: 11,
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "mortality", "medication"],
        standards: ["fhir", "hl7v2"],
        readiness: "partially_curated",
        consent_basis: "pseudonymised",
        access_model: "dua_required",
        data_can_leave_institution: "unsure",
        ethics_approval: "in_progress",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Vistula Histopathology Archive",
    org_type: "hospital",
    country: "PL",
    one_liner: "Digitised histopathology slides, oncology, 30k cases, expert-labelled.",
    summary:
      "Whole-slide imaging archive for solid tumours with pathologist annotations. Registered-access model; interested in an AI partner for computational pathology.",
    languages: ["pl", "en"],
    looking_for: ["ai_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20"],
    contact_name: "Fabricated Contact D",
    contact_email: "holder-d@example.invalid",
    datasets: [
      {
        name: "Vistula WSI Oncology",
        modality: ["imaging_histopath"],
        disease_area: ["oncology"],
        n_subjects: "10k_100k",
        volume: "10_100tb",
        longitudinal: false,
        annotation: "expert_labelled",
        linkage: ["outcomes"],
        standards: ["dicom", "proprietary"],
        readiness: "ai_ready",
        consent_basis: "broad_consent",
        access_model: "registered_access",
        data_can_leave_institution: "yes",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Danube Metabolic Cohort",
    org_type: "research_institute",
    country: "AT",
    one_liner: "Multi-omics metabolic-disease cohort, 8k subjects, deeply phenotyped.",
    summary:
      "Longitudinal metabolic and endocrine cohort combining metabolomics, proteomics and structured EHR. OMOP-mapped. Open to a modelling partner for risk prediction.",
    languages: ["de", "en"],
    looking_for: ["ai_partner", "compute"],
    application_status: "undecided",
    parallel_public_funding: "no",
    attending: ["event_sept_1"],
    contact_name: "Fabricated Contact E",
    contact_email: "holder-e@example.invalid",
    datasets: [
      {
        name: "Danube Multi-Omics Metabolic",
        modality: ["metabolomics", "proteomics", "ehr_structured"],
        disease_area: ["metabolic_endocrine"],
        n_subjects: "1k_10k",
        volume: "100gb_1tb",
        time_span_years: 6,
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "medication"],
        standards: ["omop_cdm", "fhir"],
        readiness: "ai_ready",
        consent_basis: "broad_consent",
        access_model: "dua_required",
        data_can_leave_institution: "yes",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Thames Neuroimaging Consortium Store",
    org_type: "university",
    country: "GB",
    one_liner: "BIDS-formatted brain MRI, 25k subjects, psychiatry + neurology.",
    summary:
      "Research-grade structural and functional brain MRI in BIDS, spanning neurology and psychiatry cohorts. TRE-only access; strong governance team in place.",
    languages: ["en"],
    looking_for: ["ai_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_3"],
    contact_name: "Fabricated Contact F",
    contact_email: "holder-f@example.invalid",
    datasets: [
      {
        name: "Thames Brain MRI",
        modality: ["imaging_mri"],
        disease_area: ["neurology", "psychiatry"],
        n_subjects: "10k_100k",
        volume: "10_100tb",
        longitudinal: true,
        annotation: "partial",
        linkage: ["outcomes"],
        standards: ["bids", "dicom"],
        readiness: "partially_curated",
        consent_basis: "research_art9_2j",
        access_model: "secure_processing_environment_only",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Iberian Respiratory Claims Warehouse",
    org_type: "research_institute",
    country: "ES",
    one_liner: "Population claims + registry, respiratory disease, 1.2M subjects.",
    summary:
      "Large-scale insurance claims linked to a respiratory disease registry. De-identified extracts available under DUA. Seeking an AI partner for prognosis modelling.",
    languages: ["es", "en"],
    looking_for: ["ai_partner"],
    application_status: "undecided",
    parallel_public_funding: "no",
    attending: ["remote_only"],
    contact_name: "Fabricated Contact G",
    contact_email: "holder-g@example.invalid",
    datasets: [
      {
        name: "Iberian Respiratory Claims",
        modality: ["claims", "registry"],
        disease_area: ["respiratory"],
        n_subjects: "gt_1m",
        volume: "1_10tb",
        time_span_years: 8,
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "medication", "mortality"],
        standards: ["omop_cdm"],
        readiness: "partially_curated",
        consent_basis: "public_task_art6_1e",
        access_model: "dua_required",
        data_can_leave_institution: "yes",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Helvetia Paediatric Registry",
    org_type: "hospital",
    country: "CH",
    one_liner: "Paediatric multi-domain registry, 15k children, outcome-linked.",
    summary:
      "A paediatric clinical registry spanning multiple domains, with structured records and clinical notes. Federated analysis preferred; raw notes stay on-prem.",
    languages: ["de", "fr", "en"],
    looking_for: ["ai_partner", "clinical_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20"],
    contact_name: "Fabricated Contact H",
    contact_email: "holder-h@example.invalid",
    datasets: [
      {
        name: "Helvetia Paediatric",
        modality: ["ehr_structured", "clinical_notes", "registry"],
        disease_area: ["paediatrics", "multi_domain"],
        n_subjects: "10k_100k",
        volume: "100gb_1tb",
        longitudinal: true,
        annotation: "partial",
        linkage: ["outcomes"],
        standards: ["fhir", "snomed"],
        readiness: "partially_curated",
        consent_basis: "study_specific_consent",
        access_model: "federated_no_movement",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
        governance_notes: "Paediatric consent requires guardian sign-off; strictly federated.",
      },
    ],
  },
  {
    org_name: "Baltic Wearable Health Study",
    org_type: "university",
    country: "EE",
    one_liner: "Wearable sensor + EHR, cardiometabolic, 20k participants.",
    summary:
      "A digital-health cohort combining continuous wearable sensor streams with structured EHR for cardiometabolic risk. AI-ready feature store; open to compute-supported partners.",
    languages: ["en"],
    looking_for: ["ai_partner", "compute"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["event_sept_2"],
    contact_name: "Fabricated Contact I",
    contact_email: "holder-i@example.invalid",
    datasets: [
      {
        name: "Baltic Wearable",
        modality: ["wearable_sensor", "ehr_structured"],
        disease_area: ["cardiovascular", "metabolic_endocrine"],
        n_subjects: "10k_100k",
        volume: "1_10tb",
        time_span_years: 4,
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "medication"],
        standards: ["fhir", "omop_cdm"],
        readiness: "ai_ready",
        consent_basis: "broad_consent",
        access_model: "registered_access",
        data_can_leave_institution: "yes",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Lisbon Infectious Disease Cohort",
    org_type: "research_institute",
    country: "PT",
    one_liner: "Infectious-disease cohort with genomics + clinical notes, 6k cases.",
    summary:
      "Pathogen genomics linked to structured clinical outcomes and free-text notes. Early-stage curation; seeking clinical NLP and governance support.",
    languages: ["en"],
    looking_for: ["ai_partner", "data_governance_support"],
    application_status: "undecided",
    parallel_public_funding: "unsure",
    attending: ["remote_only"],
    contact_name: "Fabricated Contact J",
    contact_email: "holder-j@example.invalid",
    datasets: [
      {
        name: "Lisbon Infectious",
        modality: ["genomics", "clinical_notes"],
        disease_area: ["infectious"],
        n_subjects: "1k_10k",
        volume: "100gb_1tb",
        longitudinal: false,
        annotation: "partial",
        linkage: ["outcomes"],
        standards: ["vcf", "proprietary"],
        readiness: "raw",
        consent_basis: "study_specific_consent",
        access_model: "undecided",
        data_can_leave_institution: "unsure",
        ethics_approval: "in_progress",
        publicly_describable: false,
        governance_notes: "Detail hidden publicly pending ethics sign-off.",
      },
    ],
  },
  {
    org_name: "Öresund Women's Health Registry",
    org_type: "biobank_or_registry",
    country: "SE",
    one_liner: "Women's-health registry, imaging + EHR, 50k subjects.",
    summary:
      "Registry combining mammography imaging with structured records for women's-health research. Benchmark-ready subset available; open to diagnostics AI teams.",
    languages: ["sv", "en"],
    looking_for: ["ai_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_1"],
    contact_name: "Fabricated Contact K",
    contact_email: "holder-k@example.invalid",
    datasets: [
      {
        name: "Öresund Women's Health",
        modality: ["imaging_xray", "ehr_structured", "registry"],
        disease_area: ["womens_health", "oncology"],
        n_subjects: "10k_100k",
        volume: "10_100tb",
        longitudinal: true,
        annotation: "expert_labelled",
        linkage: ["outcomes", "mortality"],
        standards: ["dicom", "omop_cdm"],
        readiness: "benchmark_ready",
        consent_basis: "broad_consent",
        access_model: "registered_access",
        data_can_leave_institution: "yes",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Amstel Geriatric Care Network",
    org_type: "hospital",
    country: "NL",
    one_liner: "Geriatric EHR + claims, polypharmacy focus, 80k patients.",
    summary:
      "Integrated geriatric care records with medication and claims linkage, focused on polypharmacy and frailty. TRE access; strong governance office.",
    languages: ["nl", "en"],
    looking_for: ["ai_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["event_sept_3"],
    contact_name: "Fabricated Contact L",
    contact_email: "holder-l@example.invalid",
    datasets: [
      {
        name: "Amstel Geriatric",
        modality: ["ehr_structured", "claims"],
        disease_area: ["geriatrics", "multi_domain"],
        n_subjects: "10k_100k",
        volume: "100gb_1tb",
        time_span_years: 7,
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "medication", "mortality"],
        standards: ["fhir", "omop_cdm", "snomed"],
        readiness: "ai_ready",
        consent_basis: "public_task_art6_1e",
        access_model: "secure_processing_environment_only",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// AI teams (12)
// ---------------------------------------------------------------------------

const aiTeamSeeds: Raw[] = [
  {
    org_name: "Helix Vision Labs",
    org_type: "startup",
    country: "DE",
    one_liner: "Computer-vision oncology diagnostics; TRE-native, federated-capable.",
    summary:
      "A computer-vision team building tumour-detection models for MRI and CT. We work entirely inside secure processing environments and support federated training.",
    website: "https://example.com/helix-vision",
    languages: ["de", "en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_1"],
    contact_name: "Fabricated Contact M",
    contact_email: "team-m@example.invalid",
    methods: ["computer_vision", "foundation_models", "multimodal"],
    application_target: ["diagnostics", "biomarker_discovery"],
    domain_expertise: ["oncology"],
    clinical_partner: "need",
    regulatory_experience: ["ce_marking", "gdpr_dpia"],
    compute: "own_cluster",
    compute_scale: "16x H100",
    privacy_capability: ["can_work_in_tre", "federated_capable", "differential_privacy"],
    team_size: "6_15",
    track_record: ["https://example.com/helix/pub1", "https://example.com/helix/pub2"],
    data_needs: {
      modality: ["imaging_mri", "imaging_ct"],
      disease_area: ["oncology"],
      min_n_subjects: "10k_100k",
      annotation_required: "outcome_linked",
      linkage_required: ["outcomes"],
      standards_preferred: ["dicom", "omop_cdm"],
    },
  },
  {
    org_name: "Liffey Clinical NLP",
    org_type: "company",
    country: "IE",
    one_liner: "Clinical NLP for free-text notes; on-prem and federated.",
    summary:
      "We extract structured signals from clinical notes across languages. GDPR-DPIA experienced, on-prem deployment, no data export required.",
    languages: ["en"],
    looking_for: ["dataset_access", "clinical_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20"],
    contact_name: "Fabricated Contact N",
    contact_email: "team-n@example.invalid",
    methods: ["clinical_nlp", "foundation_models"],
    application_target: ["clinical_decision_support", "prognosis_risk"],
    domain_expertise: ["multi_domain"],
    clinical_partner: "need",
    regulatory_experience: ["gdpr_dpia"],
    compute: "cloud_budget",
    privacy_capability: ["on_prem_only", "federated_capable"],
    team_size: "2_5",
    track_record: ["https://example.com/liffey/pub1"],
    data_needs: {
      modality: ["clinical_notes", "ehr_structured"],
      disease_area: ["multi_domain"],
      min_n_subjects: "1k_10k",
      annotation_required: "partial",
      linkage_required: ["outcomes"],
      standards_preferred: ["fhir", "snomed"],
    },
  },
  {
    org_name: "Kestrel Genomics AI",
    org_type: "startup",
    country: "GB",
    one_liner: "Rare-disease variant interpretation; federated by design.",
    summary:
      "Graph and foundation models for genomic variant interpretation in rare disease. Built for federated learning; never requires raw data export.",
    languages: ["en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_2"],
    contact_name: "Fabricated Contact O",
    contact_email: "team-o@example.invalid",
    methods: ["graph_knowledge", "foundation_models", "federated_learning"],
    application_target: ["diagnostics", "biomarker_discovery"],
    domain_expertise: ["rare_disease", "neurology"],
    clinical_partner: "have",
    regulatory_experience: ["gdpr_dpia"],
    compute: "cloud_budget",
    privacy_capability: ["federated_capable", "can_work_in_tre"],
    team_size: "2_5",
    track_record: ["https://example.com/kestrel/pub1"],
    data_needs: {
      modality: ["genomics", "transcriptomics"],
      disease_area: ["rare_disease"],
      min_n_subjects: "1k_10k",
      annotation_required: "expert_labelled",
      linkage_required: ["genomics"],
      standards_preferred: ["vcf"],
    },
  },
  {
    org_name: "Cadence Cardio AI",
    org_type: "startup",
    country: "IT",
    one_liner: "ECG foundation models for arrhythmia risk; requires data export.",
    summary:
      "We build waveform foundation models for cardiovascular risk. Our current pipeline requires exporting de-identified extracts to our cloud environment.",
    languages: ["it", "en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["event_sept_2"],
    contact_name: "Fabricated Contact P",
    contact_email: "team-p@example.invalid",
    methods: ["foundation_models", "survival_longitudinal"],
    application_target: ["prognosis_risk", "triage_workflow"],
    domain_expertise: ["cardiovascular"],
    clinical_partner: "need",
    regulatory_experience: ["ce_marking"],
    compute: "cloud_budget",
    privacy_capability: ["requires_data_export"],
    team_size: "2_5",
    track_record: ["https://example.com/cadence/pub1"],
    data_needs: {
      modality: ["waveform_ecg_eeg", "ehr_structured"],
      disease_area: ["cardiovascular"],
      min_n_subjects: "10k_100k",
      annotation_required: "outcome_linked",
      linkage_required: ["outcomes", "mortality"],
      standards_preferred: ["fhir"],
    },
  },
  {
    org_name: "Lumen Pathology AI",
    org_type: "company",
    country: "FR",
    one_liner: "Computational pathology on whole-slide images; TRE-native.",
    summary:
      "Foundation models for computational pathology. We operate inside institutional TREs and export only model weights and derived metrics.",
    languages: ["fr", "en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20"],
    contact_name: "Fabricated Contact Q",
    contact_email: "team-q@example.invalid",
    methods: ["computer_vision", "foundation_models"],
    application_target: ["diagnostics", "biomarker_discovery"],
    domain_expertise: ["oncology"],
    clinical_partner: "not_needed",
    regulatory_experience: ["ce_marking", "ivdr"],
    compute: "own_cluster",
    compute_scale: "8x A100",
    privacy_capability: ["can_work_in_tre", "differential_privacy"],
    team_size: "6_15",
    track_record: ["https://example.com/lumen/pub1", "https://example.com/lumen/pub2"],
    data_needs: {
      modality: ["imaging_histopath"],
      disease_area: ["oncology"],
      min_n_subjects: "10k_100k",
      annotation_required: "expert_labelled",
      linkage_required: ["outcomes"],
      standards_preferred: ["dicom"],
    },
  },
  {
    org_name: "Synthase Data",
    org_type: "startup",
    country: "NL",
    one_liner: "Synthetic-data generation for privacy-safe modelling.",
    summary:
      "We generate high-fidelity synthetic derivatives so partners can prototype without touching source data. Synthetic-only footprint; no export of real records.",
    languages: ["nl", "en"],
    looking_for: ["dataset_access", "ai_partner"],
    application_status: "undecided",
    parallel_public_funding: "no",
    attending: ["event_sept_3"],
    contact_name: "Fabricated Contact R",
    contact_email: "team-r@example.invalid",
    methods: ["synthetic_data", "privacy_tech"],
    application_target: ["trial_design", "clinical_decision_support"],
    domain_expertise: ["multi_domain"],
    clinical_partner: "not_needed",
    regulatory_experience: ["gdpr_dpia"],
    compute: "cloud_budget",
    privacy_capability: ["synthetic_only", "differential_privacy"],
    team_size: "2_5",
    track_record: ["https://example.com/synthase/pub1"],
    data_needs: {
      modality: ["ehr_structured"],
      disease_area: ["multi_domain"],
      min_n_subjects: "10k_100k",
      annotation_required: "none",
      linkage_required: [],
      standards_preferred: ["omop_cdm"],
    },
  },
  {
    org_name: "Aurora Causal Health",
    org_type: "research_institute",
    country: "FI",
    one_liner: "Causal inference for treatment effects; federated + TRE.",
    summary:
      "A causal-inference group estimating treatment effects from observational cohorts. Federated-capable and TRE-native, GDPR-DPIA experienced.",
    languages: ["en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_1"],
    contact_name: "Fabricated Contact S",
    contact_email: "team-s@example.invalid",
    methods: ["causal_inference", "classical_ml_biostat", "survival_longitudinal"],
    application_target: ["drug_repurposing", "prognosis_risk"],
    domain_expertise: ["metabolic_endocrine", "cardiovascular"],
    clinical_partner: "need",
    regulatory_experience: ["gdpr_dpia"],
    compute: "own_cluster",
    privacy_capability: ["federated_capable", "can_work_in_tre"],
    team_size: "6_15",
    track_record: ["https://example.com/aurora/pub1"],
    data_needs: {
      modality: ["ehr_structured", "claims"],
      disease_area: ["metabolic_endocrine", "cardiovascular"],
      min_n_subjects: "100k_1m",
      annotation_required: "outcome_linked",
      linkage_required: ["outcomes", "medication"],
      standards_preferred: ["omop_cdm"],
    },
  },
  {
    org_name: "Neura Signal",
    org_type: "startup",
    country: "IL",
    one_liner: "Multimodal brain-MRI + EHR for psychiatry; TRE-capable.",
    summary:
      "Multimodal models combining brain MRI with structured records for psychiatric outcome prediction. We can operate within a TRE and support federated setups.",
    languages: ["en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["event_sept_3", "remote_only"],
    contact_name: "Fabricated Contact T",
    contact_email: "team-t@example.invalid",
    methods: ["multimodal", "computer_vision", "foundation_models"],
    application_target: ["prognosis_risk", "clinical_decision_support"],
    domain_expertise: ["psychiatry", "neurology"],
    clinical_partner: "need",
    regulatory_experience: ["gdpr_dpia"],
    compute: "cloud_budget",
    privacy_capability: ["can_work_in_tre", "federated_capable"],
    team_size: "2_5",
    track_record: ["https://example.com/neura/pub1"],
    data_needs: {
      modality: ["imaging_mri", "ehr_structured"],
      disease_area: ["psychiatry", "neurology"],
      min_n_subjects: "10k_100k",
      annotation_required: "partial",
      linkage_required: ["outcomes"],
      standards_preferred: ["bids", "fhir"],
    },
  },
  {
    org_name: "Tessera Wearables AI",
    org_type: "startup",
    country: "DK",
    one_liner: "Wearable time-series risk models; requires cloud export.",
    summary:
      "We model continuous wearable sensor streams for cardiometabolic risk. Our pipeline currently needs de-identified export to our cloud.",
    languages: ["da", "en"],
    looking_for: ["dataset_access", "compute"],
    application_status: "undecided",
    parallel_public_funding: "no",
    attending: ["event_sept_2"],
    contact_name: "Fabricated Contact U",
    contact_email: "team-u@example.invalid",
    methods: ["survival_longitudinal", "classical_ml_biostat"],
    application_target: ["prognosis_risk", "triage_workflow"],
    domain_expertise: ["cardiovascular", "metabolic_endocrine"],
    clinical_partner: "not_needed",
    regulatory_experience: ["none"],
    compute: "need_compute",
    privacy_capability: ["requires_data_export"],
    team_size: "1",
    track_record: [],
    data_needs: {
      modality: ["wearable_sensor", "ehr_structured"],
      disease_area: ["cardiovascular"],
      min_n_subjects: "1k_10k",
      annotation_required: "outcome_linked",
      linkage_required: ["outcomes"],
      standards_preferred: ["fhir"],
    },
  },
  {
    org_name: "Palantea Diagnostics",
    org_type: "company",
    country: "ES",
    one_liner: "Respiratory prognosis on claims + registry data; federated.",
    summary:
      "Prognosis models for respiratory disease built on large claims and registry data. Federated-capable, GDPR-DPIA experienced, cloud budget in place.",
    languages: ["es", "en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["remote_only"],
    contact_name: "Fabricated Contact V",
    contact_email: "team-v@example.invalid",
    methods: ["classical_ml_biostat", "survival_longitudinal"],
    application_target: ["prognosis_risk"],
    domain_expertise: ["respiratory"],
    clinical_partner: "need",
    regulatory_experience: ["gdpr_dpia"],
    compute: "cloud_budget",
    privacy_capability: ["federated_capable", "can_work_in_tre"],
    team_size: "6_15",
    track_record: ["https://example.com/palantea/pub1"],
    data_needs: {
      modality: ["claims", "registry"],
      disease_area: ["respiratory"],
      min_n_subjects: "100k_1m",
      annotation_required: "outcome_linked",
      linkage_required: ["outcomes", "medication"],
      standards_preferred: ["omop_cdm"],
    },
  },
  {
    org_name: "Orbit Paediatric ML",
    org_type: "research_institute",
    country: "CH",
    one_liner: "Paediatric risk models across domains; on-prem federated.",
    summary:
      "Federated risk models for paediatric care. We deploy on-prem inside partner institutions and never move raw data.",
    languages: ["de", "fr", "en"],
    looking_for: ["dataset_access", "clinical_partner"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20"],
    contact_name: "Fabricated Contact W",
    contact_email: "team-w@example.invalid",
    methods: ["federated_learning", "classical_ml_biostat"],
    application_target: ["clinical_decision_support", "prognosis_risk"],
    domain_expertise: ["paediatrics", "multi_domain"],
    clinical_partner: "have",
    regulatory_experience: ["gdpr_dpia"],
    compute: "own_cluster",
    privacy_capability: ["federated_capable", "on_prem_only"],
    team_size: "6_15",
    track_record: ["https://example.com/orbit/pub1"],
    data_needs: {
      modality: ["ehr_structured", "registry"],
      disease_area: ["paediatrics"],
      min_n_subjects: "10k_100k",
      annotation_required: "partial",
      linkage_required: ["outcomes"],
      standards_preferred: ["fhir", "snomed"],
    },
  },
  {
    org_name: "Vector Women's Imaging",
    org_type: "startup",
    country: "SE",
    one_liner: "Mammography diagnostics; benchmark-ready, TRE + export options.",
    summary:
      "Diagnostic imaging models for women's health. We can work in a TRE or with de-identified benchmark exports, whichever governance allows.",
    languages: ["sv", "en"],
    looking_for: ["dataset_access"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_1"],
    contact_name: "Fabricated Contact X",
    contact_email: "team-x@example.invalid",
    methods: ["computer_vision", "foundation_models"],
    application_target: ["diagnostics", "biomarker_discovery"],
    domain_expertise: ["womens_health", "oncology"],
    clinical_partner: "need",
    regulatory_experience: ["ce_marking", "mdr"],
    compute: "own_cluster",
    compute_scale: "4x H100",
    privacy_capability: ["can_work_in_tre", "requires_data_export"],
    team_size: "2_5",
    track_record: ["https://example.com/vector/pub1"],
    data_needs: {
      modality: ["imaging_xray"],
      disease_area: ["womens_health"],
      min_n_subjects: "10k_100k",
      annotation_required: "expert_labelled",
      linkage_required: ["outcomes"],
      standards_preferred: ["dicom"],
    },
  },
]

// ---------------------------------------------------------------------------
// Consortia (3)
// ---------------------------------------------------------------------------

const consortiumSeeds: Raw[] = [
  {
    org_name: "Alliance for Oncology Imaging AI",
    org_type: "research_institute",
    country: "DE",
    one_liner: "Combined imaging bank + CV team; still seeking a clinical partner.",
    summary:
      "A formed consortium pairing an oncology imaging bank with a computer-vision team. Team is largely complete; we are still seeking a clinical validation partner.",
    website: "https://example.org/aoia",
    languages: ["de", "en"],
    looking_for: ["clinical_partner"],
    application_status: "applying_with_partner",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20", "event_sept_1"],
    contact_name: "Fabricated Contact Y",
    contact_email: "consortium-y@example.invalid",
    still_seeking: ["clinical_partner"],
    methods: ["computer_vision", "foundation_models"],
    application_target: ["diagnostics"],
    domain_expertise: ["oncology"],
    clinical_partner: "need",
    regulatory_experience: ["ce_marking", "gdpr_dpia"],
    compute: "own_cluster",
    privacy_capability: ["can_work_in_tre", "federated_capable"],
    team_size: "6_15",
    track_record: ["https://example.org/aoia/pub1"],
    data_needs: {
      modality: ["imaging_mri", "imaging_ct"],
      disease_area: ["oncology"],
      min_n_subjects: "10k_100k",
      annotation_required: "outcome_linked",
      linkage_required: ["outcomes"],
      standards_preferred: ["dicom"],
    },
    datasets: [
      {
        name: "AOIA Oncology Imaging",
        modality: ["imaging_mri", "imaging_ct"],
        disease_area: ["oncology"],
        n_subjects: "10k_100k",
        volume: "10_100tb",
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "mortality"],
        standards: ["dicom", "omop_cdm"],
        readiness: "ai_ready",
        consent_basis: "broad_consent",
        access_model: "secure_processing_environment_only",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Federated Cardiometabolic Initiative",
    org_type: "university",
    country: "NL",
    one_liner: "Complete federated cardiometabolic team — not seeking partners.",
    summary:
      "A complete consortium running federated cardiometabolic research across sites. The team is complete and is included for directory visibility only.",
    languages: ["nl", "en"],
    looking_for: ["not_looking"],
    application_status: "team_complete",
    parallel_public_funding: "no",
    attending: ["remote_only"],
    contact_name: "Fabricated Contact Z",
    contact_email: "consortium-z@example.invalid",
    still_seeking: [],
    methods: ["federated_learning", "causal_inference"],
    application_target: ["prognosis_risk"],
    domain_expertise: ["cardiovascular", "metabolic_endocrine"],
    clinical_partner: "have",
    regulatory_experience: ["gdpr_dpia"],
    compute: "own_cluster",
    privacy_capability: ["federated_capable", "can_work_in_tre"],
    team_size: "gt_15",
    track_record: ["https://example.org/fci/pub1"],
    data_needs: {
      modality: ["ehr_structured"],
      disease_area: ["cardiovascular", "metabolic_endocrine"],
      min_n_subjects: "100k_1m",
      annotation_required: "outcome_linked",
      linkage_required: ["outcomes"],
      standards_preferred: ["omop_cdm"],
    },
    datasets: [
      {
        name: "FCI Multi-Site EHR",
        modality: ["ehr_structured"],
        disease_area: ["cardiovascular", "metabolic_endocrine"],
        n_subjects: "100k_1m",
        volume: "1_10tb",
        longitudinal: true,
        annotation: "outcome_linked",
        linkage: ["outcomes", "medication", "mortality"],
        standards: ["omop_cdm", "fhir"],
        readiness: "ai_ready",
        consent_basis: "public_task_art6_1e",
        access_model: "federated_no_movement",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
  {
    org_name: "Rare Disease Genomics Coalition",
    org_type: "research_institute",
    country: "FR",
    one_liner: "Genomics registry + AI team; still seeking compute and governance.",
    summary:
      "A coalition combining a rare-disease genomics registry with a modelling team. We are still seeking additional compute and data-governance support.",
    languages: ["fr", "en"],
    looking_for: ["compute", "data_governance_support"],
    application_status: "applying_with_partner",
    parallel_public_funding: "no",
    attending: ["webinar_2026_08_20"],
    contact_name: "Fabricated Contact AA",
    contact_email: "consortium-aa@example.invalid",
    still_seeking: ["compute", "data_governance_support"],
    methods: ["graph_knowledge", "federated_learning"],
    application_target: ["diagnostics", "biomarker_discovery"],
    domain_expertise: ["rare_disease", "neurology"],
    clinical_partner: "have",
    regulatory_experience: ["gdpr_dpia"],
    compute: "need_compute",
    privacy_capability: ["federated_capable"],
    team_size: "6_15",
    track_record: ["https://example.org/rdgc/pub1"],
    data_needs: {
      modality: ["genomics"],
      disease_area: ["rare_disease"],
      min_n_subjects: "1k_10k",
      annotation_required: "expert_labelled",
      linkage_required: ["genomics"],
      standards_preferred: ["vcf"],
    },
    datasets: [
      {
        name: "RDGC Genomes",
        modality: ["genomics", "transcriptomics"],
        disease_area: ["rare_disease", "neurology"],
        n_subjects: "1k_10k",
        volume: "1_10tb",
        longitudinal: false,
        annotation: "expert_labelled",
        linkage: ["genomics", "outcomes"],
        standards: ["vcf"],
        readiness: "partially_curated",
        consent_basis: "study_specific_consent",
        access_model: "federated_no_movement",
        data_can_leave_institution: "no",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Bulk filler — combinatorial generation to fill out the directory
// ---------------------------------------------------------------------------
//
// The hand-authored profiles above read well but are too few to make the
// alphabetical index or the filter dropdowns feel inhabited. This section
// deterministically combines a small vocabulary of fictional place names and
// organisation nouns into unique names, spread across every HQ-eligible
// country (plus a couple of ineligible ones, to exercise `partner_only`),
// with dataset/capability details drawn from a seeded PRNG — never
// `Math.random()` — so the output is stable and diffable across runs.

/** Mulberry32: tiny, fast, deterministic PRNG seeded by an integer. */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

/** Pick between `min` and `max` (inclusive) distinct items, order preserved. */
function pickN<T>(rng: () => number, arr: readonly T[], min: number, max: number): T[] {
  const n = Math.min(arr.length, min + Math.floor(rng() * (max - min + 1)))
  const pool = [...arr]
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * pool.length)
    out.push(pool.splice(idx, 1)[0]!)
  }
  return out
}

/** Fictional place-name fragments — never a real city, region, or river. */
const PLACE_WORDS = [
  "Boreal",
  "Carpath",
  "Delta",
  "Ems",
  "Fjordane",
  "Garda",
  "Halcyon",
  "Isarburg",
  "Juniper",
  "Karst",
  "Loiret",
  "Meander",
  "Nidaros",
  "Odra",
  "Pyrenova",
  "Quercia",
  "Ravenna",
  "Savona",
  "Tundra",
  "Umbra",
  "Vltava",
  "Wistula",
  "Ypres",
  "Zephyra",
] as const

const DATA_HOLDER_NOUNS = [
  "University Hospital",
  "Regional Data Centre",
  "National Registry",
  "Biobank Consortium",
  "Clinical Research Institute",
  "Diagnostic Imaging Centre",
  "Health Data Trust",
  "Cancer Registry",
  "Population Cohort Study",
  "Medical Data Archive",
] as const

const AI_TEAM_NOUNS = [
  "AI Diagnostics",
  "Health Analytics Lab",
  "Applied ML Group",
  "Computational Medicine",
  "Clinical Intelligence",
  "Signal Sciences",
  "BioAI Systems",
  "Precision Health AI",
  "Data Science Collective",
  "Foundation Health Models",
] as const

const CONSORTIUM_NOUNS = [
  "Health Data Alliance",
  "Joint Research Initiative",
  "Cross-Border Consortium",
  "Precision Medicine Network",
  "Data & AI Coalition",
] as const

/** Every HQ-eligible country (EU-27 + EFTA + UK + Israel), cycled by index. */
const GEN_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO",
  "CH", "GB", "IL",
] as const

/** A plausible primary language per country, from the LANGUAGE enum — "en" is always added separately. */
const LANGUAGE_BY_COUNTRY: Record<string, Language> = {
  AT: "de", BE: "nl", BG: "other", HR: "other", CY: "el", CZ: "cs",
  DK: "da", EE: "other", FI: "fi", FR: "fr", DE: "de", GR: "el",
  HU: "hu", IE: "en", IT: "it", LV: "other", LT: "other", LU: "fr",
  MT: "other", NL: "nl", PL: "pl", PT: "pt", RO: "ro", SK: "other",
  SI: "other", ES: "es", SE: "sv", IS: "other", LI: "de", NO: "other",
  CH: "de", GB: "en", IL: "he",
}

function languagesFor(country: string): Language[] {
  const local = LANGUAGE_BY_COUNTRY[country] ?? "other"
  return local === "en" ? ["en"] : [local, "en"]
}

const ORG_TYPES_BY_KIND = {
  data_holder: ["university", "hospital", "biobank_or_registry", "research_institute"] as const,
  ai_team: ["startup", "company", "research_institute", "university"] as const,
} as const

/** A generated org name from a deterministic (place, noun) pair — always unique by construction. */
function generatedName(i: number, nouns: readonly string[]): { name: string; place: string } {
  const place = PLACE_WORDS[i % PLACE_WORDS.length]!
  const noun = nouns[Math.floor(i / PLACE_WORDS.length) % nouns.length]!
  return { name: `${place} ${noun}`, place }
}

function genDataHolder(i: number): Raw {
  const rng = mulberry32(0x0d47a1 + i * 7919)
  const { name, place } = generatedName(i, DATA_HOLDER_NOUNS)
  const country = GEN_COUNTRIES[i % GEN_COUNTRIES.length]!
  const diseaseAreas = pickN(rng, DISEASE_AREA.filter((d) => d !== "other"), 1, 2) as DiseaseArea[]
  const modalities = pickN(rng, MODALITY.filter((m) => m !== "other"), 1, 2)
  const slug = slugify(name)

  return {
    org_name: name,
    org_type: pick(rng, ORG_TYPES_BY_KIND.data_holder),
    country,
    one_liner: `Synthetic ${diseaseAreas[0]!.replace(/_/g, " ")} dataset for demonstration purposes.`,
    summary: `A fabricated ${place}-region data holder generated to populate the demo directory. Not a real institution — see /seed/README.md.`,
    languages: languagesFor(country),
    looking_for: ["ai_partner"],
    application_status: pick(rng, APPLICATION_STATUS.filter((s) => s !== "not_applying")),
    parallel_public_funding: rng() < 0.08 ? "yes" : rng() < 0.15 ? "unsure" : "no",
    attending: pickN(rng, ATTENDING, 1, 2),
    contact_name: `Fabricated Contact (${slug})`,
    contact_email: `${slug}@example.invalid`,
    contact_role: "Data Protection Officer",
    datasets: [
      {
        name: `${place} ${diseaseAreas[0]!.replace(/_/g, " ")} dataset`,
        modality: modalities,
        disease_area: diseaseAreas,
        n_subjects: pick(rng, N_SUBJECTS),
        volume: pick(rng, VOLUME),
        longitudinal: rng() < 0.5,
        annotation: pick(rng, ANNOTATION),
        linkage: pickN(rng, LINKAGE.filter((l) => l !== "none"), 1, 2),
        standards: pickN(rng, STANDARDS.filter((s) => s !== "none"), 1, 2),
        readiness: pick(rng, READINESS),
        consent_basis: pick(rng, CONSENT_BASIS),
        access_model: pick(rng, ACCESS_MODEL.filter((a) => a !== "undecided")),
        data_can_leave_institution: pick(rng, ["yes", "no", "unsure"] as const),
        ethics_approval: pick(rng, ETHICS_APPROVAL),
        publicly_describable: rng() > 0.1,
      },
    ],
  }
}

function genAiTeam(i: number): Raw {
  const rng = mulberry32(0x1a2b3c + i * 104729)
  const { name, place } = generatedName(i, AI_TEAM_NOUNS)
  const country = GEN_COUNTRIES[i % GEN_COUNTRIES.length]!
  const domainAreas = pickN(rng, DISEASE_AREA.filter((d) => d !== "other"), 1, 2) as DiseaseArea[]
  const needModalities = pickN(rng, MODALITY.filter((m) => m !== "other"), 1, 2)
  const slug = slugify(name)

  return {
    org_name: name,
    org_type: pick(rng, ORG_TYPES_BY_KIND.ai_team),
    country,
    one_liner: `Synthetic ${domainAreas[0]!.replace(/_/g, " ")} AI team for demonstration purposes.`,
    summary: `A fabricated ${place}-region AI team generated to populate the demo directory. Not a real organisation — see /seed/README.md.`,
    languages: languagesFor(country),
    looking_for: ["dataset_access"],
    application_status: pick(rng, APPLICATION_STATUS.filter((s) => s !== "not_applying")),
    parallel_public_funding: rng() < 0.05 ? "yes" : rng() < 0.12 ? "unsure" : "no",
    attending: pickN(rng, ATTENDING, 1, 2),
    contact_name: `Fabricated Contact (${slug})`,
    contact_email: `${slug}@example.invalid`,
    methods: pickN(rng, METHODS.filter((m) => m !== "other"), 1, 3),
    application_target: pickN(rng, APPLICATION_TARGET.filter((a) => a !== "other"), 1, 2),
    domain_expertise: domainAreas,
    clinical_partner: pick(rng, CLINICAL_PARTNER),
    regulatory_experience: pickN(rng, REGULATORY_EXPERIENCE.filter((r) => r !== "none"), 0, 2),
    compute: pick(rng, COMPUTE),
    privacy_capability: pickN(rng, PRIVACY_CAPABILITY, 1, 2),
    team_size: pick(rng, TEAM_SIZE),
    track_record: rng() < 0.4 ? [`https://example.com/${slug}/pub1`] : [],
    data_needs: {
      modality: needModalities,
      disease_area: domainAreas,
      min_n_subjects: pick(rng, N_SUBJECTS),
      annotation_required: pick(rng, ANNOTATION),
      linkage_required: pickN(rng, LINKAGE.filter((l) => l !== "none"), 0, 2),
      standards_preferred: pickN(rng, STANDARDS.filter((s) => s !== "none"), 0, 2),
    },
  }
}

/** A couple of ineligible-HQ teams, to keep `partner_only` exercised beyond the one golden fixture. */
function genPartnerOnlyAiTeam(i: number, country: "US" | "CA" | "AU"): Raw {
  const base = genAiTeam(i)
  return {
    ...base,
    country,
    languages: ["en"],
    partner_only: true,
    one_liner: `${base.one_liner as string} (collaboration partner only — HQ outside the eligible region.)`,
  }
}

function genConsortium(i: number): Raw {
  const rng = mulberry32(0x654321 + i * 15485863)
  const { name, place } = generatedName(i, CONSORTIUM_NOUNS)
  const country = GEN_COUNTRIES[i % GEN_COUNTRIES.length]!
  const diseaseAreas = pickN(rng, DISEASE_AREA.filter((d) => d !== "other"), 1, 2) as DiseaseArea[]
  const modalities = pickN(rng, MODALITY.filter((m) => m !== "other"), 1, 2)
  const slug = slugify(name)
  const stillSeeking = pickN(rng, ["clinical_partner", "compute", "data_governance_support"] as const, 0, 2)

  return {
    org_name: name,
    org_type: "research_institute",
    country,
    one_liner: `Synthetic ${diseaseAreas[0]!.replace(/_/g, " ")} consortium for demonstration purposes.`,
    summary: `A fabricated ${place}-region consortium generated to populate the demo directory. Not a real organisation — see /seed/README.md.`,
    languages: languagesFor(country),
    looking_for: stillSeeking.length > 0 ? stillSeeking : (["not_looking"] as const),
    application_status: stillSeeking.length > 0 ? "applying_with_partner" : "team_complete",
    parallel_public_funding: "no",
    attending: pickN(rng, ATTENDING, 1, 2),
    contact_name: `Fabricated Contact (${slug})`,
    contact_email: `${slug}@example.invalid`,
    still_seeking: stillSeeking,
    methods: pickN(rng, METHODS.filter((m) => m !== "other"), 1, 2),
    application_target: pickN(rng, APPLICATION_TARGET.filter((a) => a !== "other"), 1, 2),
    domain_expertise: diseaseAreas,
    clinical_partner: pick(rng, CLINICAL_PARTNER),
    regulatory_experience: pickN(rng, REGULATORY_EXPERIENCE.filter((r) => r !== "none"), 0, 2),
    compute: pick(rng, COMPUTE),
    privacy_capability: pickN(rng, PRIVACY_CAPABILITY, 1, 2),
    team_size: pick(rng, TEAM_SIZE.filter((s) => s !== "1")),
    track_record: [],
    data_needs: {
      modality: modalities,
      disease_area: diseaseAreas,
      min_n_subjects: pick(rng, N_SUBJECTS),
      linkage_required: [],
      standards_preferred: [],
    },
    datasets: [
      {
        name: `${place} consortium dataset`,
        modality: modalities,
        disease_area: diseaseAreas,
        n_subjects: pick(rng, N_SUBJECTS),
        volume: pick(rng, VOLUME),
        longitudinal: rng() < 0.5,
        annotation: pick(rng, ANNOTATION),
        linkage: pickN(rng, LINKAGE.filter((l) => l !== "none"), 1, 2),
        standards: pickN(rng, STANDARDS.filter((s) => s !== "none"), 1, 2),
        readiness: pick(rng, READINESS),
        consent_basis: pick(rng, CONSENT_BASIS),
        access_model: pick(rng, ACCESS_MODEL.filter((a) => a !== "undecided")),
        data_can_leave_institution: pick(rng, ["yes", "no", "unsure"] as const),
        ethics_approval: pick(rng, ETHICS_APPROVAL),
        publicly_describable: true,
      },
    ],
  }
}

const GENERATED_DATA_HOLDER_COUNT = 38
const GENERATED_AI_TEAM_COUNT = 36
const GENERATED_CONSORTIUM_COUNT = 5

const generatedDataHolders: Raw[] = Array.from({ length: GENERATED_DATA_HOLDER_COUNT }, (_, i) => genDataHolder(i))
const generatedAiTeams: Raw[] = [
  ...Array.from({ length: GENERATED_AI_TEAM_COUNT }, (_, i) => genAiTeam(i)),
  genPartnerOnlyAiTeam(GENERATED_AI_TEAM_COUNT, "US"),
  genPartnerOnlyAiTeam(GENERATED_AI_TEAM_COUNT + 1, "CA"),
]
const generatedConsortia: Raw[] = Array.from({ length: GENERATED_CONSORTIUM_COUNT }, (_, i) => genConsortium(i))

dataHolderSeeds.push(...generatedDataHolders)
aiTeamSeeds.push(...generatedAiTeams)
consortiumSeeds.push(...generatedConsortia)

// Defensive: the whole point of deterministic (place, noun) pairing is that
// names never collide. Assert it instead of silently overwriting a profile.
function assertUniqueSlugs(seeds: Raw[], label: string): void {
  const seen = new Set<string>()
  for (const s of seeds) {
    const slug = slugify(String(s.org_name))
    if (seen.has(slug)) throw new Error(`generate-seed: duplicate slug "${slug}" in ${label}`)
    seen.add(slug)
  }
}
assertUniqueSlugs(dataHolderSeeds, "data holders")
assertUniqueSlugs(aiTeamSeeds, "ai teams")
assertUniqueSlugs(consortiumSeeds, "consortia")

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function finalize(raw: Raw, kind: Profile["kind"], idPrefix: "dh" | "ai" | "co", i: number): Profile {
  const withMeta = {
    ...raw,
    kind,
    id: fakeUuid(idPrefix, i),
    slug: slugify(String(raw.org_name)),
    created_at: NOW,
    updated_at: NOW,
    claimed_at: NOW,
    // Placeholders; overwritten by applyDerivedFields.
    eligible_hq: false,
    completeness: 0,
    partner_only: false,
  } as unknown as Profile & { country: string }

  const derived = applyDerivedFields(withMeta)
  // Validate against the real schema — throws if anything is off.
  return profileSchema.parse(derived)
}

function main() {
  mkdirSync(SEED_DIR, { recursive: true })

  const dataHolders = dataHolderSeeds.map((r, i) => finalize(r, "data_holder", "dh", i))
  const aiTeams = aiTeamSeeds.map((r, i) => finalize(r, "ai_team", "ai", i))
  const consortia = consortiumSeeds.map((r, i) => finalize(r, "consortium", "co", i))

  writeFileSync(resolve(SEED_DIR, "data-holders.json"), JSON.stringify(dataHolders, null, 2) + "\n")
  writeFileSync(resolve(SEED_DIR, "ai-teams.json"), JSON.stringify(aiTeams, null, 2) + "\n")
  writeFileSync(resolve(SEED_DIR, "consortia.json"), JSON.stringify(consortia, null, 2) + "\n")

  // eslint-disable-next-line no-console
  console.log(
    `wrote seed: ${dataHolders.length} data holders, ${aiTeams.length} ai teams, ${consortia.length} consortia`,
  )
}

main()
