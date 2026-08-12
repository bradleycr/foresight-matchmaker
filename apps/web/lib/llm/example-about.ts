import type { PrefillProposal } from "./prefill"

/**
 * Example “About” copy for demo / rehearsal — paste into Remmy or the
 * pre-fill box. Contact details are deliberately absent so the form still
 * asks the human to fill those in.
 */
export const EXAMPLE_AI_ABOUT = `About — Meridian Vision Lab (Berlin)

Meridian Vision Lab is a research institute spin-out and AI/ML team headquartered in Germany (DE). We build multimodal foundation models for computational pathology and oncology diagnostics.

We specialise in computer vision, foundation models, and multimodal learning on whole-slide histopathology images linked to clinical outcomes. Our application targets are diagnostics, biomarker discovery, and prognosis / risk stratification. Domain expertise: oncology.

We typically work with cohorts of 10,000–100,000 subjects and prefer DICOM and FHIR-compatible pipelines. Outcome-linked annotation and linkage to mortality and treatment outcomes are required for our studies.

Privacy: we can work inside a trusted research environment and are federated-learning capable; we do not require raw data export when a TRE or federated node is available. Regulatory experience includes GDPR DPIA work with hospital partners. We currently need a clinical partner for Recoding Medicine.

Compute: cloud GPU budget (approx. 8× H100 for fine-tuning). Team size is 6–15. Working languages: German and English. We intend to apply to SPRIND Recoding Medicine and are looking for dataset access and a clinical partner. We can attend the webinar remotely.

Website: https://example.org/meridian-vision
Selected publications: https://example.org/meridian-vision/pubs
`

export const EXAMPLE_HOLDER_ABOUT = `About — Nordlicht Clinical Data Centre

Nordlicht Clinical Data Centre is a university hospital data integration centre in Germany. We hold a longitudinal cardiology cohort combining structured EHR, 12-lead ECG waveforms, and echocardiography, covering roughly 10,000–100,000 patients over 14 years.

Data is FHIR- and OMOP-aligned, outcome-linked (readmission and mortality), and available only inside our secure processing environment — data cannot leave the institution. Ethics approval is in place under broad consent. The archive is partially curated and AI-ready for partners who can work on-prem or in our TRE.

We speak German and English, intend to apply to Recoding Medicine, and are looking for an AI modelling partner with TRE or federated capability. Website: https://example.org/nordlicht-dic
`

/** Hand-authored proposal for EXAMPLE_AI_ABOUT — demo never depends on a flaky LLM for this fixture. */
export const EXAMPLE_AI_PROPOSAL: PrefillProposal = {
  kind: "ai_team",
  org_name: "Meridian Vision Lab",
  org_type: "research_institute",
  country: "DE",
  one_liner: "Multimodal foundation models for computational pathology and oncology diagnostics.",
  summary:
    "Research institute spin-out building computer vision, foundation models, and multimodal learning on whole-slide histopathology linked to clinical outcomes. Seeking dataset access and a clinical partner for SPRIND Recoding Medicine; can work in a TRE and is federated-capable.",
  website: "https://example.org/meridian-vision",
  languages: ["de", "en"],
  looking_for: ["dataset_access", "clinical_partner"],
  methods: ["computer_vision", "foundation_models", "multimodal"],
  application_target: ["diagnostics", "biomarker_discovery", "prognosis_risk"],
  domain_expertise: ["oncology"],
  clinical_partner: "need",
  regulatory_experience: ["gdpr_dpia"],
  compute: "cloud_budget",
  privacy_capability: ["can_work_in_tre", "federated_capable"],
  team_size: "6_15",
  track_record: ["https://example.org/meridian-vision/pubs"],
  data_needs: {
    modality: ["imaging_histopath"],
    disease_area: ["oncology"],
    min_n_subjects: "10k_100k",
    annotation_required: "outcome_linked",
    linkage_required: ["outcomes", "mortality"],
    standards_preferred: ["dicom", "fhir"],
  },
  datasets: [],
}

export function matchesExampleAiAbout(text: string): boolean {
  const n = text.replace(/\s+/g, " ").toLowerCase()
  return n.includes("meridian vision lab") && n.includes("computational pathology")
}

/** True when a proposal has enough to visibly fill the form. */
export function proposalIsSubstantial(p: PrefillProposal | null | undefined): boolean {
  if (!p) return false
  return Boolean(p.org_name?.trim() || p.one_liner?.trim() || p.summary?.trim())
}
