import type {
  Dataset,
  Kind,
  OrgType,
  Language,
  LookingFor,
  Attending,
  Methods,
  ApplicationTarget,
  DiseaseArea,
  ApplicationStatus,
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
  org_type_other: string
  country: string
  one_liner: string
  summary: string
  website: string
  languages: Language[]
  looking_for: LookingFor[]
  looking_for_other: string
  attending: Attending[]
  application_status: ApplicationStatus
  affiliation: string
  methods: Methods[]
  methods_other: string
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
  needs_modality_other: string
  needs_disease_area_other: string
  needs_min_n_subjects: NSubjects | ""
  needs_annotation: Annotation | ""
  needs_linkage: Linkage[]
  needs_standards: Standards[]
  datasets: Dataset[]
  still_seeking: LookingFor[]
  compute_scale: string
  intended_public_contribution: string
  funding_mainly_needed_for: string
  best_public_dataset: string
}

function mergePartialDataset(partial: Partial<Dataset>): Dataset {
  const d = emptyDataset()
  if (partial.name?.trim()) d.name = partial.name.trim().slice(0, 160)
  if (partial.modality?.length) d.modality = partial.modality
  if (partial.modality_other?.trim()) d.modality_other = partial.modality_other.trim().slice(0, 200)
  if (partial.disease_area?.length) d.disease_area = partial.disease_area
  if (partial.disease_area_other?.trim()) d.disease_area_other = partial.disease_area_other.trim().slice(0, 200)
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

function orgTypeForKind(kind: Kind, current: OrgType): OrgType {
  if (kind === "individual") return "individual"
  if (current !== "individual") return current
  if (kind === "ai_team") return "startup"
  if (kind === "consortium") return "university"
  return "hospital"
}

function resetForKind<T extends ProposalMergeTarget>(state: T, kind: Kind): T {
  if (state.kind === kind) return state

  const org_type = orgTypeForKind(kind, state.org_type)
  const team_size = kind === "individual" ? ("1" as const) : state.kind === "individual" ? ("2_5" as const) : state.team_size

  if (kind === "data_holder") {
    return {
      ...state,
      kind,
      org_type,
      team_size,
      methods: [],
      methods_other: "",
      application_target: [],
      domain_expertise: [],
      regulatory_experience: [],
      privacy_capability: [],
      track_record: "",
      needs_modality: [],
      needs_disease_area: [],
      needs_modality_other: "",
      needs_disease_area_other: "",
      needs_min_n_subjects: "",
      needs_annotation: "",
      needs_linkage: [],
      needs_standards: [],
      still_seeking: [],
      affiliation: "",
      datasets: state.datasets.length ? state.datasets : [emptyDataset()],
    }
  }

  if (kind === "ai_team" || kind === "individual") {
    return {
      ...state,
      kind,
      org_type,
      team_size,
      datasets: [emptyDataset()],
      still_seeking: [],
      ...(kind === "individual"
        ? {
            looking_for: state.looking_for.includes("join_team")
              ? state.looking_for
              : [...state.looking_for, "join_team" as const],
          }
        : { affiliation: "" }),
    }
  }

  return {
    ...state,
    kind,
    org_type,
    team_size,
    affiliation: "",
    datasets: state.datasets.length ? state.datasets : [emptyDataset()],
  }
}

const PRESERVE_TEXT = new Set([
  "org_name",
  "one_liner",
  "summary",
  "website",
  "affiliation",
    "looking_for_other",
    "methods_other",
    "org_type_other",
    "needs_modality_other",
    "needs_disease_area_other",
    "compute_scale",
  "intended_public_contribution",
  "funding_mainly_needed_for",
  "best_public_dataset",
  "track_record",
])

function mayWrite(key: string, current: string, preserve?: ReadonlySet<string>): boolean {
  if (!preserve?.has(key)) return true
  if (!PRESERVE_TEXT.has(key)) return true
  return current.trim().length === 0
}

export function mergeProposalIntoForm<T extends ProposalMergeTarget>(
  state: T,
  raw: PrefillProposal,
  countryCodes: readonly string[],
  preserve?: ReadonlySet<string>,
): T {
  const p = sanitizeProposal(raw)
  let next: T = p.kind ? resetForKind(state, p.kind) : { ...state }

  if (p.org_name && mayWrite("org_name", next.org_name, preserve)) next = { ...next, org_name: p.org_name }
  if (p.org_type) next = { ...next, org_type: p.org_type }
  if (p.country && countryCodes.includes(p.country)) next = { ...next, country: p.country }
  if (p.one_liner && mayWrite("one_liner", next.one_liner, preserve)) next = { ...next, one_liner: p.one_liner }
  if (p.summary && mayWrite("summary", next.summary, preserve)) next = { ...next, summary: p.summary }
  if (p.website && mayWrite("website", next.website, preserve)) next = { ...next, website: p.website }
  if (p.languages.length) next = { ...next, languages: p.languages }
  if (p.looking_for.length) next = { ...next, looking_for: p.looking_for }
  if (p.still_seeking?.length) next = { ...next, still_seeking: p.still_seeking }
  if (p.attending?.length) next = { ...next, attending: p.attending }
  if (p.application_status) next = { ...next, application_status: p.application_status }
  if (p.affiliation && mayWrite("affiliation", next.affiliation, preserve)) next = { ...next, affiliation: p.affiliation }
  if (p.methods.length) next = { ...next, methods: p.methods }
  if (p.methods_other && mayWrite("methods_other", next.methods_other, preserve)) {
    next = {
      ...next,
      methods_other: p.methods_other,
      methods: next.methods.includes("other") ? next.methods : [...next.methods, "other"],
    }
  }
  if (p.looking_for_other && mayWrite("looking_for_other", next.looking_for_other, preserve)) {
    const hasOther = next.looking_for.includes("other") || next.still_seeking.includes("other")
    next = {
      ...next,
      looking_for_other: p.looking_for_other,
      looking_for: hasOther ? next.looking_for : [...next.looking_for, "other"],
    }
  }
  if (p.org_type_other && next.kind !== "individual" && mayWrite("org_type_other", next.org_type_other, preserve)) {
    next = { ...next, org_type_other: p.org_type_other, org_type: "other" }
  }
  if (p.application_target.length) next = { ...next, application_target: p.application_target }
  if (p.domain_expertise.length) next = { ...next, domain_expertise: p.domain_expertise }
  if (p.clinical_partner) next = { ...next, clinical_partner: p.clinical_partner }
  if (p.regulatory_experience.length) next = { ...next, regulatory_experience: p.regulatory_experience }
  if (p.compute) next = { ...next, compute: p.compute }
  if (p.compute_scale && mayWrite("compute_scale", next.compute_scale, preserve)) next = { ...next, compute_scale: p.compute_scale }
  if (p.privacy_capability.length) next = { ...next, privacy_capability: p.privacy_capability }
  if (p.team_size) next = { ...next, team_size: p.team_size }
  if (p.track_record.length && mayWrite("track_record", next.track_record, preserve)) next = { ...next, track_record: p.track_record.join("\n") }
  if (p.intended_public_contribution && mayWrite("intended_public_contribution", next.intended_public_contribution, preserve)) {
    next = { ...next, intended_public_contribution: p.intended_public_contribution }
  }
  if (p.funding_mainly_needed_for && mayWrite("funding_mainly_needed_for", next.funding_mainly_needed_for, preserve)) {
    next = { ...next, funding_mainly_needed_for: p.funding_mainly_needed_for }
  }
  if (p.best_public_dataset && mayWrite("best_public_dataset", next.best_public_dataset, preserve)) {
    next = { ...next, best_public_dataset: p.best_public_dataset }
  }

  if (p.data_needs) {
    if (p.data_needs.modality.length) next = { ...next, needs_modality: p.data_needs.modality }
    if (p.data_needs.modality_other && mayWrite("needs_modality_other", next.needs_modality_other, preserve)) {
      next = { ...next, needs_modality_other: p.data_needs.modality_other }
    }
    if (p.data_needs.disease_area.length) next = { ...next, needs_disease_area: p.data_needs.disease_area }
    if (p.data_needs.disease_area_other && mayWrite("needs_disease_area_other", next.needs_disease_area_other, preserve)) {
      next = { ...next, needs_disease_area_other: p.data_needs.disease_area_other }
    }
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

  if (next.kind === "individual") {
    next = { ...next, org_type: "individual" as T["org_type"], team_size: "1" as T["team_size"] }
  } else if (next.org_type === "individual") {
    next = { ...next, org_type: orgTypeForKind(next.kind, "individual") as T["org_type"] }
  }

  return next
}

/**
 * First fill replaces a blank list. Signup almost always has one dataset;
 * later Remmy turns overlay that row so extra details do not spawn a second.
 * Two-or-more started rows still match by name.
 */
function mergeDatasetLists(current: Dataset[], incoming: Dataset[]): Dataset[] {
  if (incoming.length === 0) return current.length > 0 ? current : [emptyDataset()]

  const started = current.filter((d) => !isDatasetBlank(d))
  if (started.length === 0) return incoming

  if (started.length === 1) {
    let merged = started[0]!
    for (const row of incoming) merged = overlayDataset(merged, row)
    return [merged]
  }

  const next = started.map((d) => ({ ...d }))
  for (const row of incoming) {
    const key = row.name.trim().toLowerCase()
    const idx = key ? next.findIndex((d) => d.name.trim().toLowerCase() === key) : -1
    if (idx >= 0) {
      next[idx] = overlayDataset(next[idx]!, row)
    } else if (!key) {
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

function sameDefault<K extends keyof Dataset>(incoming: Dataset, blank: Dataset, key: K): boolean {
  const a = incoming[key]
  const b = blank[key]
  if (Array.isArray(a)) {
    if (a.length === 0) return true
    return Array.isArray(b) && JSON.stringify(a) === JSON.stringify(b)
  }
  return a === b
}

function overlayDataset(base: Dataset, incoming: Dataset): Dataset {
  const blank = emptyDataset()
  const scalar = <K extends keyof Dataset>(key: K): Dataset[K] =>
    sameDefault(incoming, blank, key) ? base[key] : incoming[key]

  return {
    ...base,
    name: base.name.trim() || incoming.name,
    modality: base.modality.length > 0 ? base.modality : incoming.modality,
    modality_other: incoming.modality_other?.trim() || base.modality_other,
    disease_area: base.disease_area.length > 0 ? base.disease_area : incoming.disease_area,
    disease_area_other: incoming.disease_area_other?.trim() || base.disease_area_other,
    n_subjects: scalar("n_subjects"),
    volume: scalar("volume"),
    time_span_years: incoming.time_span_years ?? base.time_span_years,
    longitudinal: scalar("longitudinal"),
    annotation: scalar("annotation"),
    linkage: sameDefault(incoming, blank, "linkage") ? base.linkage : incoming.linkage,
    standards: sameDefault(incoming, blank, "standards") ? base.standards : incoming.standards,
    readiness: scalar("readiness"),
    consent_basis: scalar("consent_basis"),
    access_model: scalar("access_model"),
    data_can_leave_institution: scalar("data_can_leave_institution"),
    ethics_approval: scalar("ethics_approval"),
    available_from: incoming.available_from ?? base.available_from,
    publicly_describable: scalar("publicly_describable"),
    governance_notes: incoming.governance_notes || base.governance_notes,
  }
}
