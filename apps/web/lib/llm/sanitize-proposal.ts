import type { Dataset } from "@rmm/schema"
import type { PrefillProposal } from "./prefill"

/** A dataset row worth showing in the form (name + at least one tag). */
export function datasetRowHasSignal(d: Partial<Dataset>): boolean {
  return Boolean(d.name?.trim() || d.modality?.length || d.disease_area?.length)
}

/** A dataset row complete enough to list publicly / pass submit validation. */
export function datasetRowIsComplete(d: Partial<Dataset>): boolean {
  return Boolean(d.name?.trim() && d.modality?.length && d.disease_area?.length)
}

/**
 * Last-mile cleanup before any proposal reaches the UI or form state.
 * Strips unsafe / junk values the extractor may hallucinate.
 */
export function sanitizeProposal(p: PrefillProposal): PrefillProposal {
  return {
    ...p,
    org_name: p.org_name?.trim().slice(0, 200) || undefined,
    one_liner: p.one_liner?.trim().slice(0, 140) || undefined,
    summary: p.summary?.trim().slice(0, 600) || undefined,
    track_record: (p.track_record ?? []).slice(0, 5),
    datasets: (p.datasets ?? []).filter(datasetRowHasSignal).slice(0, 5),
  }
}

/** Human-readable warnings to show on the review card. */
export function proposalWarnings(p: PrefillProposal): string[] {
  const warnings: string[] = []
  const skipped = (p.datasets ?? []).filter((d) => datasetRowHasSignal(d) && !datasetRowIsComplete(d))
  if (skipped.length > 0) {
    warnings.push(
      skipped.length === 1
        ? "One dataset draft is incomplete — finish name, modality, and disease area on the form."
        : `${skipped.length} dataset drafts are incomplete — finish name, modality, and disease area on the form.`,
    )
  }
  if (!p.kind) warnings.push("Profile type (data holder / AI team / consortium) was not detected — pick it on the form.")
  warnings.push("Contact email is never filled automatically — enter it yourself before submitting.")
  return warnings
}
