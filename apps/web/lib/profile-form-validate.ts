import type { Dataset, Kind } from "@rmm/schema"
import { parseUrlLines, tryNormalizeUrl } from "./normalize-url"

/** A dataset the user never started — safe to drop before submit. */
export function isDatasetBlank(d: Dataset): boolean {
  return d.name.trim().length === 0 && d.modality.length === 0 && d.disease_area.length === 0
}

export function filterDatasetsForSubmit(datasets: Dataset[]): Dataset[] {
  return datasets
    .filter((d) => !isDatasetBlank(d))
    .map((d) => ({
      ...d,
      modality_other: d.modality.includes("other") ? d.modality_other?.trim() || undefined : undefined,
      disease_area_other: d.disease_area.includes("other") ? d.disease_area_other?.trim() || undefined : undefined,
      linkage: d.linkage.length > 0 ? d.linkage : (["none"] as Dataset["linkage"]),
      standards: d.standards.length > 0 ? d.standards : (["none"] as Dataset["standards"]),
    }))
}

export type ValidationIssue = {
  /** DOM id to scroll to */
  fieldId: string
  /** i18n key under form.validation.* */
  messageKey: string
  /** Interpolation values for the message */
  params?: Record<string, string | number>
}

interface ValidateInput {
  kind: Kind
  website: string
  track_record: string
  datasets: Dataset[]
  org_type?: string
  org_type_other?: string
  looking_for?: string[]
  still_seeking?: string[]
  looking_for_other?: string
  methods?: string[]
  methods_other?: string
  needs_modality?: string[]
  needs_modality_other?: string
  needs_disease_area?: string[]
  needs_disease_area_other?: string
}

/** Client-side checks with human-readable issue keys — run before hitting the API. */
export function collectValidationIssues(input: ValidateInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const website = input.website.trim()
  if (website && !tryNormalizeUrl(website)) {
    issues.push({ fieldId: "gap-website", messageKey: "form.validation.website_invalid" })
  }

  const { invalidLines } = parseUrlLines(input.track_record)
  if (invalidLines.length > 0) {
    issues.push({
      fieldId: "gap-track_record",
      messageKey: "form.validation.track_record_invalid",
      params: { lines: invalidLines.slice(0, 3).join("; ") },
    })
  }

  if (input.org_type === "other" && !input.org_type_other?.trim()) {
    issues.push({ fieldId: "org_type_other", messageKey: "form.validation.org_type_other" })
  }

  const looking = [...(input.looking_for ?? []), ...(input.still_seeking ?? [])]
  if (looking.includes("other") && !input.looking_for_other?.trim()) {
    issues.push({ fieldId: "looking_for_other", messageKey: "form.validation.looking_for_other" })
  }

  if (input.methods?.includes("other") && !input.methods_other?.trim()) {
    issues.push({ fieldId: "methods_other", messageKey: "form.validation.methods_other" })
  }

  if (input.needs_modality?.includes("other") && !input.needs_modality_other?.trim()) {
    issues.push({ fieldId: "needs_modality_other", messageKey: "form.validation.modality_other" })
  }

  if (input.needs_disease_area?.includes("other") && !input.needs_disease_area_other?.trim()) {
    issues.push({ fieldId: "needs_disease_area_other", messageKey: "form.validation.disease_area_other" })
  }

  const showData = input.kind === "data_holder" || input.kind === "consortium"
  if (showData) {
    const datasets = filterDatasetsForSubmit(input.datasets)
    if (datasets.length === 0) {
      issues.push({ fieldId: "gap-datasets", messageKey: "form.validation.datasets_required" })
    } else {
      input.datasets.forEach((d, i) => {
        if (isDatasetBlank(d)) return
        const n = i + 1
        if (!d.name.trim()) {
          issues.push({
            fieldId: `ds-name-${i}`,
            messageKey: "form.validation.dataset_name",
            params: { n },
          })
        }
        if (d.modality.length === 0) {
          issues.push({
            fieldId: `ds-modality-${i}`,
            messageKey: "form.validation.dataset_modality",
            params: { n },
          })
        }
        if (d.disease_area.length === 0) {
          issues.push({
            fieldId: `ds-disease-${i}`,
            messageKey: "form.validation.dataset_disease",
            params: { n },
          })
        }
        if (d.modality.includes("other") && !d.modality_other?.trim()) {
          issues.push({
            fieldId: `ds-modality-other-${i}`,
            messageKey: "form.validation.modality_other",
            params: { n },
          })
        }
        if (d.disease_area.includes("other") && !d.disease_area_other?.trim()) {
          issues.push({
            fieldId: `ds-disease-other-${i}`,
            messageKey: "form.validation.disease_area_other",
            params: { n },
          })
        }
      })
    }
  }

  return issues
}

/** Map a Zod/API path to a scroll target when we can. */
export function fieldIdFromApiPath(path: string): string | null {
  if (path === "website") return "gap-website"
  if (path.startsWith("track_record")) return "gap-track_record"
  if (path.startsWith("datasets")) {
    const m = path.match(/^datasets\.(\d+)\.(name|modality|disease_area)/)
    if (m) {
      const i = m[1]
      if (m[2] === "name") return `ds-name-${i}`
      if (m[2] === "modality") return `ds-modality-${i}`
      if (m[2] === "disease_area") return `ds-disease-${i}`
    }
    return "gap-datasets"
  }
  if (path === "org_name") return "gap-org_name"
  if (path === "one_liner") return "gap-one_liner"
  if (path === "contact_email") return "gap-contact_email"
  if (path === "org_type_other") return "org_type_other"
  if (path === "looking_for_other") return "looking_for_other"
  if (path === "methods_other") return "methods_other"
  if (path === "modality_other" || path.endsWith(".modality_other")) {
    const m = path.match(/^datasets\.(\d+)/)
    return m ? `ds-modality-other-${m[1]}` : "needs_modality_other"
  }
  if (path === "disease_area_other" || path.endsWith(".disease_area_other")) {
    const m = path.match(/^datasets\.(\d+)/)
    return m ? `ds-disease-other-${m[1]}` : "needs_disease_area_other"
  }
  if (path === "data_needs.modality_other") return "needs_modality_other"
  if (path === "data_needs.disease_area_other") return "needs_disease_area_other"
  return null
}

/** Turn raw Zod messages into clearer copy where the default is opaque. */
export function friendlyApiMessage(path: string, message: string): string {
  if (path.startsWith("track_record") && /invalid url/i.test(message)) {
    return "Each line must be a full web link (e.g. https://github.com/your-org/paper)."
  }
  if (path.startsWith("datasets") && path.endsWith("modality") && /array must contain/i.test(message)) {
    const m = path.match(/^datasets\.(\d+)/)
    return m ? `Dataset ${Number(m[1]) + 1}: pick at least one modality.` : "Pick at least one modality for each dataset."
  }
  if (path.startsWith("datasets") && path.endsWith("disease_area") && /array must contain/i.test(message)) {
    const m = path.match(/^datasets\.(\d+)/)
    return m ? `Dataset ${Number(m[1]) + 1}: pick at least one disease area.` : "Pick at least one disease area for each dataset."
  }
  if (path.startsWith("datasets") && path.endsWith("name")) {
    const m = path.match(/^datasets\.(\d+)/)
    return m ? `Dataset ${Number(m[1]) + 1}: enter a name.` : "Each dataset needs a name."
  }
  if (path === "website" && /invalid url/i.test(message)) {
    return "Website must be a full link starting with https://"
  }
  return message
}
