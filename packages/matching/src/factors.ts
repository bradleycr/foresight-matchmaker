import type { Factor, PairingSides, Dataset, DataNeeds } from "./types.js"
import { jaccard, overlaps } from "./helpers.js"

/**
 * Soft scoring factors for an oriented pairing. Each factor contributes
 * 0..weight points; the sum of all weights is 100, so the raw score is already
 * on a 0–100 scale before blockers are applied.
 *
 * Weights (total 100):
 *   modality_fit          25  — does the data cover the modalities the team needs?
 *   disease_area_fit      20  — clinical domain overlap
 *   subjects_fit          12  — cohort large enough for the team's minimum
 *   annotation_fit        10  — labels present when the team requires them
 *   linkage_fit            8  — record linkage the team asked for
 *   standards_fit          7  — interoperability standards overlap
 *   readiness_fit         10  — how deployment-ready the data is
 *   language_fit           4  — shared working language
 *   attending_fit          4  — both at the same event (a real intro can happen)
 */

const READINESS_SCORE: Record<string, number> = {
  ready_now: 1,
  minor_prep: 0.75,
  significant_prep: 0.4,
  concept_only: 0.15,
}

const N_SUBJECTS_ORDER = [
  "lt_100",
  "100_1k",
  "1k_10k",
  "10k_100k",
  "100k_1m",
  "gt_1m",
] as const

function nSubjectsRank(v: string | undefined): number {
  if (!v) return -1
  return N_SUBJECTS_ORDER.indexOf(v as (typeof N_SUBJECTS_ORDER)[number])
}

/** Best single dataset for a given need dimension, scored 0..1. */
function bestModalityFit(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (needs.modality.length === 0) return 0.5 // no stated need → neutral
  let best = 0
  for (const d of datasets) best = Math.max(best, jaccard(d.modality, needs.modality))
  return best
}

function bestDiseaseFit(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (needs.disease_area.length === 0) return 0.5
  let best = 0
  for (const d of datasets) best = Math.max(best, jaccard(d.disease_area, needs.disease_area))
  return best
}

function subjectsFit(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (!needs.min_n_subjects) return 0.5
  const required = nSubjectsRank(needs.min_n_subjects)
  const best = Math.max(...datasets.map((d) => nSubjectsRank(d.n_subjects)), -1)
  if (best < 0) return 0
  return best >= required ? 1 : Math.max(0, 1 - (required - best) * 0.34)
}

function annotationFit(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (!needs.annotation_required || needs.annotation_required === "none") return 0.5
  // A team requiring annotation is satisfied by any annotated dataset.
  const anyAnnotated = datasets.some((d) => d.annotation !== "none")
  return anyAnnotated ? 1 : 0
}

function linkageFit(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (needs.linkage_required.length === 0) return 0.5
  let best = 0
  for (const d of datasets) best = Math.max(best, jaccard(d.linkage, needs.linkage_required))
  return best
}

function standardsFit(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (needs.standards_preferred.length === 0) return 0.5
  let best = 0
  for (const d of datasets) best = Math.max(best, jaccard(d.standards, needs.standards_preferred))
  return best
}

function readinessFit(datasets: readonly Dataset[]): number {
  return Math.max(...datasets.map((d) => READINESS_SCORE[d.readiness] ?? 0), 0)
}

function pts(weight: number, ratio: number): number {
  return Math.round(weight * Math.max(0, Math.min(1, ratio)))
}

/** Compute all soft factors for an oriented pairing. */
export function computeFactors(sides: PairingSides): Factor[] {
  const { datasets, needs, dataSide, aiSide } = sides

  const modalityRatio = bestModalityFit(datasets, needs)
  const diseaseRatio = bestDiseaseFit(datasets, needs)
  const subjectsRatio = subjectsFit(datasets, needs)
  const annotationRatio = annotationFit(datasets, needs)
  const linkageRatio = linkageFit(datasets, needs)
  const standardsRatio = standardsFit(datasets, needs)
  const readinessRatio = readinessFit(datasets)
  const languageRatio = overlaps(dataSide.languages, aiSide.languages) ? 1 : 0
  const attendingRatio = overlaps(dataSide.attending, aiSide.attending) ? 1 : 0

  return [
    { key: "modality_fit", weight: 25, earned: pts(25, modalityRatio), note: modalityNote(modalityRatio) },
    { key: "disease_area_fit", weight: 20, earned: pts(20, diseaseRatio), note: diseaseNote(diseaseRatio) },
    { key: "subjects_fit", weight: 12, earned: pts(12, subjectsRatio), note: subjectsNote(subjectsRatio) },
    { key: "annotation_fit", weight: 10, earned: pts(10, annotationRatio), note: annotationNote(annotationRatio) },
    { key: "linkage_fit", weight: 8, earned: pts(8, linkageRatio), note: "Record linkage overlap." },
    { key: "standards_fit", weight: 7, earned: pts(7, standardsRatio), note: "Interoperability standards overlap." },
    { key: "readiness_fit", weight: 10, earned: pts(10, readinessRatio), note: readinessNote(readinessRatio) },
    { key: "language_fit", weight: 4, earned: pts(4, languageRatio), note: languageRatio ? "Shared working language." : "No shared language listed." },
    { key: "attending_fit", weight: 4, earned: pts(4, attendingRatio), note: attendingRatio ? "Both attending a shared event." : "No shared event." },
  ]
}

function modalityNote(r: number): string {
  if (r >= 0.75) return "Strong modality match with the team's stated needs."
  if (r >= 0.34) return "Partial modality overlap."
  if (r === 0.5) return "Team did not state a modality need."
  return "Little or no modality overlap."
}
function diseaseNote(r: number): string {
  if (r >= 0.75) return "Clinical domain lines up well."
  if (r >= 0.34) return "Some clinical domain overlap."
  return "Limited clinical domain overlap."
}
function subjectsNote(r: number): string {
  if (r >= 1) return "Cohort meets or exceeds the team's minimum."
  if (r >= 0.5) return "Cohort is close to the team's minimum."
  return "Cohort may be smaller than the team needs."
}
function annotationNote(r: number): string {
  if (r >= 1) return "Annotated data is available as required."
  if (r === 0.5) return "Team did not require annotation."
  return "Team requires annotation the data does not provide."
}
function readinessNote(r: number): string {
  if (r >= 0.75) return "Data is ready or needs only minor prep."
  if (r >= 0.4) return "Data needs significant preparation."
  return "Data is concept-only."
}

export function sumFactors(factors: readonly Factor[]): number {
  return factors.reduce((acc, f) => acc + f.earned, 0)
}
