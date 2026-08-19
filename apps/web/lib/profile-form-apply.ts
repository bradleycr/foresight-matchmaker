import type {
  Dataset,
  Kind,
  OrgType,
  Language,
  LookingFor,
  Methods,
  ApplicationTarget,
  DiseaseArea,
  ClinicalPartner,
  RegulatoryExperience,
  Compute,
  PrivacyCapability,
  TeamSize,
  Modality,
  NSubjects,
  Annotation,
  Linkage,
  Standards,
} from "@rmm/schema"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { sanitizeProposal, datasetRowHasSignal } from "@/lib/llm/sanitize-proposal"
import { emptyDataset } from "@/components/profile-form/dataset-editor"
import { isDatasetBlank } from "@/lib/profile-form-validate"

/**
 * Shared merge logic for Remmy chat, paste-prefill, and register handoff.
 * Sanitizes upstream, resets kind-incompatible leftovers, and applies
 * dataset rows the extractor actually returned — including thin ones so
 * the form can highlight what is still open.
 */

export interface ProposalMergeTarget {
  kind: Kind
  org_name: string
  org_type: OrgType
  country: string
  one_liner: string
  summary: string
  website: string
  languages: Language[]
  looking_for: LookingFor[]
  methods: Methods[]
  application_target: ApplicationTarget[]
  domain_expertise: DiseaseArea[]
  clinical_partner: ClinicalPartner
  regulatory_experience: RegulatoryExperience[]
  compute: Compute
  privacy_capability: PrivacyCapability[]
  team_size: TeamSize
  track_record: string
  needs_modality: Modality[]
  needs_disease_area: DiseaseArea[]
  needs_min_n_subjects: NSubjects | ""
  needs_annotation: Annotation | ""
  needs_linkage: Linkage[]
  needs_standards: Standards[]
  datasets: Dataset[]
  still_seeking: LookingFor[]
}

function mergePartialDataset(partial: Partial<Dataset>): Dataset {
  const d = emptyDataset()
  if (partial.name?.trim()) d.name = partial.name.trim().slice(0, 160)
  if (partial.modality?.length) d.modality = partial.modality
  if (partial.disease_area?.length) d.disease_area = partial.disease_area
  if (partial.n_subjects) d.n_subjects = partial.n_subjects
  if (partial.volume) d.volume = partial.volume
  if (partial.time_span_years !== undefined) d.time_span_years = partial.time_span_years
  if (partial.longitudinal !== undefined) d.longitudinal = partial.longitudinal
  if (partial.annotation) d.annotation = partial.annotation
  if (partial.linkage?.length) d.linkage = partial.linkage
  if (partial.standards?.length) d.standards = partial.standards
  if (partial.readiness) d.readiness = partial.readiness
  if (partial.consent_basis) d.consent_basis = partial.consent_basis
  if (partial.access_model) d.access_model = partial.access_model
  if (partial.data_can_leave_institution) d.data_can_leave_institution = partial.data_can_leave_institution
  if (partial.ethics_approval) d.ethics_approval = partial.ethics_approval
  if (partial.available_from) d.available_from = partial.available_from
  if (partial.publicly_describable !== undefined) d.publicly_describable = partial.publicly_describable
  if (partial.governance_notes) d.governance_notes = partial.governance_notes
  return d
}

function resetForKind<T extends ProposalMergeTarget>(state: T, kind: Kind): T {
  if (state.kind === kind) return state

  if (kind === "data_holder") {
    return {
      ...state,
      kind,
      methods: [],
      application_target: [],
      domain_expertise: [],
      regulatory_experience: [],
      privacy_capability: [],
      track_record: "",
      needs_modality: [],
      needs_disease_area: [],
      needs_min_n_subjects: "",
      needs_annotation: "",
      needs_linkage: [],
      needs_standards: [],
      still_seeking: [],
      datasets: state.datasets.length ? state.datasets : [emptyDataset()],
    }
  }

  if (kind === "ai_team" || kind === "individual") {
    return {
      ...state,
      kind,
      datasets: [emptyDataset()],
      still_seeking: [],
      ...(kind === "individual"
        ? {
            org_type: "individual" as const,
            team_size: "1" as const,
            looking_for: state.looking_for.includes("join_team")
              ? state.looking_for
              : [...state.looking_for, "join_team" as const],
          }
        : {}),
    }
  }

  return {
    ...state,
    kind,
    datasets: state.datasets.length ? state.datasets : [emptyDataset()],
  }
}

export function mergeProposalIntoForm<T extends ProposalMergeTarget>(
  state: T,
  raw: PrefillProposal,
  countryCodes: readonly string[],
): T {
  const p = sanitizeProposal(raw)
  let next: T = p.kind ? resetForKind(state, p.kind) : { ...state }

  if (p.org_name) next = { ...next, org_name: p.org_name }
  if (p.org_type) next = { ...next, org_type: p.org_type }
  if (p.country && countryCodes.includes(p.country)) next = { ...next, country: p.country }
  if (p.one_liner) next = { ...next, one_liner: p.one_liner }
  if (p.summary) next = { ...next, summary: p.summary }
  if (p.website) next = { ...next, website: p.website }
  if (p.languages.length) next = { ...next, languages: p.languages }
  if (p.looking_for.length) next = { ...next, looking_for: p.looking_for }
  if (p.methods.length) next = { ...next, methods: p.methods }
  if (p.application_target.length) next = { ...next, application_target: p.application_target }
  if (p.domain_expertise.length) next = { ...next, domain_expertise: p.domain_expertise }
  if (p.clinical_partner) next = { ...next, clinical_partner: p.clinical_partner }
  if (p.regulatory_experience.length) next = { ...next, regulatory_experience: p.regulatory_experience }
  if (p.compute) next = { ...next, compute: p.compute }
  if (p.privacy_capability.length) next = { ...next, privacy_capability: p.privacy_capability }
  if (p.team_size) next = { ...next, team_size: p.team_size }
  if (p.track_record.length) next = { ...next, track_record: p.track_record.join("\n") }

  if (p.data_needs) {
    if (p.data_needs.modality.length) next = { ...next, needs_modality: p.data_needs.modality }
    if (p.data_needs.disease_area.length) next = { ...next, needs_disease_area: p.data_needs.disease_area }
    if (p.data_needs.min_n_subjects) next = { ...next, needs_min_n_subjects: p.data_needs.min_n_subjects }
    if (p.data_needs.annotation_required) next = { ...next, needs_annotation: p.data_needs.annotation_required }
    if (p.data_needs.linkage_required.length) next = { ...next, needs_linkage: p.data_needs.linkage_required }
    if (p.data_needs.standards_preferred.length) next = { ...next, needs_standards: p.data_needs.standards_preferred }
  }

  if (p.datasets.length) {
    // Keep thin rows (a name from an About page, no modality yet) so the form
    // can highlight what is still open instead of looking empty.
    const rows = p.datasets.map(mergePartialDataset).filter(datasetRowHasSignal)
    next = { ...next, datasets: mergeDatasetLists(next.datasets, rows) }
  }

  return next
}

/**
 * First fill replaces a blank list. Later Remmy turns overlay by dataset name
 * so a second chat does not wipe modality the human already typed.
 */
function mergeDatasetLists(current: Dataset[], incoming: Dataset[]): Dataset[] {
  if (incoming.length === 0) return current.length > 0 ? current : [emptyDataset()]

  const started = current.filter((d) => !isDatasetBlank(d))
  if (started.length === 0) return incoming

  const next = started.map((d) => ({ ...d }))
  for (const row of incoming) {
    const key = row.name.trim().toLowerCase()
    const idx = key ? next.findIndex((d) => d.name.trim().toLowerCase() === key) : -1
    if (idx >= 0) {
      next[idx] = overlayDataset(next[idx]!, row)
    } else if (!key) {
      // Chip-by-chip fill (modality, then disease) has no name yet — fold
      // into the first unfinished row instead of spawning a second dataset.
      const thinIdx = next.findIndex(
        (d) => !d.name.trim() || d.modality.length === 0 || d.disease_area.length === 0,
      )
      if (thinIdx >= 0) next[thinIdx] = overlayDataset(next[thinIdx]!, row)
      else next.push(row)
    } else {
      next.push(row)
    }
  }
  return next
}

function overlayDataset(base: Dataset, incoming: Dataset): Dataset {
  return {
    ...incoming,
    ...base,
    name: base.name.trim() || incoming.name,
    modality: base.modality.length > 0 ? base.modality : incoming.modality,
    disease_area: base.disease_area.length > 0 ? base.disease_area : incoming.disease_area,
  }
}
