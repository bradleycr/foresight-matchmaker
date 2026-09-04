import type { Kind } from "@rmm/schema"

/**
 * After Remmy / paste-prefill applies a draft, these fields are still empty
 * (or kind-required and missing). Contact is almost always here — models
 * must not invent emails.
 *
 * Required vs optional is the publish contract: required blocks submit;
 * optional improves matching and can wait.
 */

export type GapField =
  | "org_name"
  | "one_liner"
  | "summary"
  | "languages"
  | "looking_for"
  | "attending"
  | "contact_name"
  | "contact_email"
  | "methods"
  | "application_target"
  | "domain_expertise"
  | "privacy_capability"
  | "needs_modality"
  | "needs_disease_area"
  | "needs_min_n_subjects"
  | "needs_annotation"
  | "datasets"
  | "website"
  | "compute_scale"
  | "still_seeking"
  | "looking_for_other"
  | "org_type_other"
  | "methods_other"

export interface ClassifiedGaps {
  required: GapField[]
  optional: GapField[]
}

/** Minimal shape — anything the profile form can hand to gap detection. */
export interface GapInspectable {
  kind: Kind
  org_name: string
  one_liner: string
  summary: string
  website: string
  languages: unknown[]
  looking_for: unknown[]
  attending: unknown[]
  contact_name: string
  contact_email: string
  methods: unknown[]
  application_target: unknown[]
  domain_expertise: unknown[]
  privacy_capability: unknown[]
  needs_modality: unknown[]
  needs_disease_area: unknown[]
  needs_modality_other?: string
  needs_disease_area_other?: string
  needs_min_n_subjects: string
  needs_annotation: string
  compute_scale: string
  still_seeking?: unknown[]
  looking_for_other?: string
  org_type?: string
  org_type_other?: string
  methods_other?: string
  datasets: Array<{
    name: string
    modality: unknown[]
    disease_area: unknown[]
    n_subjects?: string
    access_model?: string
    modality_other?: string
    disease_area_other?: string
  }>
}

const empty = (s: string) => s.trim().length === 0

function datasetRequiredOpen(datasets: GapInspectable["datasets"]): boolean {
  const otherOpen = datasets.some(
    (d) =>
      (d.modality.includes("other") && empty(String(d.modality_other ?? ""))) ||
      (d.disease_area.includes("other") && empty(String(d.disease_area_other ?? ""))),
  )
  if (otherOpen) return true
  return datasets.every((d) => empty(d.name) || d.modality.length === 0 || d.disease_area.length === 0)
}

/**
 * Split empty fields into publish-blocking vs matching-helpful.
 * Conditional "Other" definitions belong in required — they were chosen.
 */
export function classifyGaps(state: GapInspectable): ClassifiedGaps {
  const required: GapField[] = []
  const optional: GapField[] = []

  if (empty(state.org_name)) required.push("org_name")
  if (empty(state.one_liner)) required.push("one_liner")
  if (empty(state.contact_name)) required.push("contact_name")
  if (empty(state.contact_email)) required.push("contact_email")

  if (empty(state.summary)) optional.push("summary")
  if (state.languages.length === 0) optional.push("languages")
  if (state.looking_for.length === 0) optional.push("looking_for")
  if (state.attending.length === 0) optional.push("attending")
  if (empty(state.website)) optional.push("website")

  const lookingHasOther =
    state.looking_for.includes("other") || (state.still_seeking ?? []).includes("other")
  if (lookingHasOther && empty(state.looking_for_other ?? "")) {
    required.push("looking_for_other")
  }
  if (state.org_type === "other" && empty(state.org_type_other ?? "")) {
    required.push("org_type_other")
  }

  const showAi = state.kind === "ai_team" || state.kind === "consortium" || state.kind === "individual"
  const showData = state.kind === "data_holder" || state.kind === "consortium"

  if (showAi) {
    if (state.methods.includes("other") && empty(state.methods_other ?? "")) {
      required.push("methods_other")
    } else if (state.methods.length === 0) {
      optional.push("methods")
    }
    if (state.application_target.length === 0) optional.push("application_target")
    if (state.privacy_capability.length === 0) optional.push("privacy_capability")
    if (state.needs_modality.includes("other") && empty(state.needs_modality_other ?? "")) {
      required.push("needs_modality")
    }
    if (state.needs_disease_area.includes("other") && empty(state.needs_disease_area_other ?? "")) {
      required.push("needs_disease_area")
    }
  }

  if (showData && datasetRequiredOpen(state.datasets)) {
    required.push("datasets")
  }

  if (state.kind === "consortium" && (state.still_seeking?.length ?? 0) === 0) {
    optional.push("still_seeking")
  }

  return { required, optional }
}

/** Flat list — required first — for callers that have not split yet. */
export function findManualGaps(state: GapInspectable): GapField[] {
  const { required, optional } = classifyGaps(state)
  return [...required, ...optional]
}

/**
 * Contact is typed on the form (and email is session-locked). Remmy
 * sprints everything else that would block publish.
 */
export function remmySprintGaps(required: readonly GapField[]): GapField[] {
  return required.filter((g) => g !== "contact_name" && g !== "contact_email")
}

export function essentialsReady(required: readonly GapField[]): boolean {
  return remmySprintGaps(required).length === 0
}

/** English hints Remmy reads when the form is already open. */
export const GAP_REMMY_HINT: Record<GapField, string> = {
  org_name: "organisation name",
  one_liner: "one-line description",
  summary: "short summary of what they do",
  languages: "working languages",
  looking_for: "what they are looking for",
  attending: "which events they plan to attend",
  contact_name: "contact name (they type this — never invent it)",
  contact_email: "contact email (they type this — never invent it)",
  methods: "AI/ML methods",
  application_target: "application target",
  domain_expertise: "clinical domain only if they have one — skip for methods/privacy/infra people",
  privacy_capability: "privacy-preserving methods they can use",
  needs_modality: "data modalities they already know they need (optional — skip if unknown)",
  needs_disease_area: "disease areas they already know they need data in (optional)",
  needs_min_n_subjects: "minimum cohort size they need (optional)",
  needs_annotation: "annotation they need on the data (optional)",
  datasets: "dataset details — name, modality, and disease area",
  website: "website URL",
  compute_scale: "compute they have access to",
  still_seeking: "what the consortium is still looking for in a partner",
  looking_for_other: "what 'Other' means for what they are looking for — their own words",
  org_type_other: "what 'Other' means for organisation type — their own words",
  methods_other: "what 'Other' means for methods — their own words",
}

export function formatGapsForRemmy(gaps: readonly string[]): string {
  if (gaps.length === 0) return ""
  return gaps
    .map((g) => {
      const hint = (GAP_REMMY_HINT as Record<string, string>)[g]
      return hint ? `- ${g}: ${hint}` : `- ${g}`
    })
    .join("\n")
}

export type OptionalGroupId = "more" | "application" | "ai" | "visibility" | "notes"

/** Which collapsed group a gap (or field id) belongs to. */
export function optionalGroupForField(field: string): OptionalGroupId | null {
  switch (field) {
    case "website":
    case "linkedin":
    case "languages":
    case "affiliation":
    case "contact_role":
    case "gap-website":
    case "gap-linkedin":
    case "gap-languages":
      return "more"
    case "looking_for":
    case "looking_for_other":
    case "attending":
    case "application_status":
    case "still_seeking":
    case "gap-looking_for":
    case "gap-attending":
    case "gap-still_seeking":
      return "application"
    case "methods":
    case "methods_other":
    case "application_target":
    case "domain_expertise":
    case "privacy_capability":
    case "compute_scale":
    case "track_record":
    case "needs_modality":
    case "needs_disease_area":
    case "gap-methods":
    case "gap-methods_other":
    case "gap-application_target":
    case "gap-privacy_capability":
    case "gap-track_record":
    case "gap-needs_modality":
    case "gap-needs_disease_area":
    case "needs_modality_other":
    case "needs_disease_area_other":
      return "ai"
    case "visibility":
    case "open_to_intros":
    case "partner_only":
      return "visibility"
    case "intended_public_contribution":
    case "funding_mainly_needed_for":
      return "notes"
    default:
      return null
  }
}
