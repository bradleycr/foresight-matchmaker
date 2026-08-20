import type { Kind } from "@rmm/schema"

/**
 * After Remmy / paste-prefill applies a draft, these fields are still empty
 * (or kind-required and missing). Contact is almost always here — models
 * must not invent emails.
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
  }>
}

export function findManualGaps(state: GapInspectable): GapField[] {
  const gaps: GapField[] = []
  const empty = (s: string) => s.trim().length === 0

  if (empty(state.org_name)) gaps.push("org_name")
  if (empty(state.one_liner)) gaps.push("one_liner")
  if (empty(state.summary)) gaps.push("summary")
  if (state.languages.length === 0) gaps.push("languages")
  if (state.looking_for.length === 0) gaps.push("looking_for")
  if (state.attending.length === 0) gaps.push("attending")
  if (empty(state.contact_name)) gaps.push("contact_name")
  if (empty(state.contact_email)) gaps.push("contact_email")
  if (empty(state.website)) gaps.push("website")

  const lookingHasOther =
    state.looking_for.includes("other") || (state.still_seeking ?? []).includes("other")
  if (lookingHasOther && empty(state.looking_for_other ?? "")) {
    gaps.push("looking_for_other")
  }
  if (state.org_type === "other" && empty(state.org_type_other ?? "")) {
    gaps.push("org_type_other")
  }

  const showAi = state.kind === "ai_team" || state.kind === "consortium" || state.kind === "individual"
  const showData = state.kind === "data_holder" || state.kind === "consortium"

  if (showAi) {
    if (state.methods.length === 0) gaps.push("methods")
    else if (state.methods.includes("other") && empty(state.methods_other ?? "")) {
      gaps.push("methods_other")
    }
    if (state.application_target.length === 0) gaps.push("application_target")
    if (state.privacy_capability.length === 0) gaps.push("privacy_capability")
    // domain_expertise and data_needs stay off this list: many AI people are
    // methods / privacy / infra, not a clinical specialty, and often do not
    // yet know which datasets they want. Matching can nudge later.
  }

  if (showData) {
    const thin = state.datasets.every(
      (d) =>
        empty(d.name) ||
        d.modality.length === 0 ||
        d.disease_area.length === 0 ||
        !d.n_subjects ||
        !d.access_model,
    )
    if (thin) gaps.push("datasets")
  }

  if (state.kind === "consortium" && (state.still_seeking?.length ?? 0) === 0) {
    gaps.push("still_seeking")
  }

  return gaps
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
  datasets: "dataset details — name, modality, disease area, scale, and access model",
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
