import {
  nSubjectsRank,
  teamSizeRank,
  ANNOTATION,
  IMAGING_MODALITIES,
  type Modality,
  type DiseaseArea,
  type Annotation,
} from "@rmm/schema"
import type { Factor, PairingSides, Dataset, DataNeeds, Profile, PeoplePairingSides } from "./types"
import { overlaps, jaccard } from "./helpers"

/**
 * Soft scoring factors for an oriented pairing, exactly as specified:
 *
 *   disease_area_fit        25  Jaccard-style overlap; `multi_domain` on
 *                               either side counts 0.5 against anything.
 *   modality_fit            22  overlap with the imaging_* variants grouped,
 *                               so imaging_mri vs imaging_ct earns 0.4, not 0.
 *   access_model_fit        18  graded compatibility between the dataset's
 *                               access constraint and the team's privacy
 *                               capability — full marks on exact fit, partial
 *                               when workable with effort.
 *   scale_fit               10  full when n_subjects ≥ the team's minimum,
 *                               half one bucket below, zero at two below.
 *   annotation_linkage_fit  10  the team's required annotation level and
 *                               linkage present in the dataset (5 + 5).
 *   readiness_capacity_fit   6  raw data + a tiny team scores low; ai_ready
 *                               scores full regardless of team size.
 *   language_fit             5  any overlap in working languages.
 *   colocation_fit           4  same country, or both at the same event.
 *
 * Weights sum to 100. Every helper returns a ratio in [0, 1]; a ratio of 0.5
 * is the convention for "no stated preference", so unstated needs neither
 * reward nor punish a pairing.
 */

// ---------------------------------------------------------------------------
// Set-overlap kernels
// ---------------------------------------------------------------------------

const IMAGING = new Set<string>(IMAGING_MODALITIES)

/**
 * Overlap of two enum sets with partial-credit rules, normalised by the
 * larger set so a single-element cross-imaging pair earns exactly its
 * partial credit (imaging_mri vs imaging_ct → 0.4, per the spec).
 */
function gradedOverlap(
  a: readonly string[],
  b: readonly string[],
  partial: (x: string, other: readonly string[]) => number,
): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  let earned = 0
  for (const x of a) {
    if (setB.has(x)) earned += 1
    else earned += partial(x, b)
  }
  return Math.min(1, earned / Math.max(a.length, b.length))
}

/** Modality: exact matches count 1, cross-imaging pairs count 0.4. */
export function modalityOverlap(datasetModalities: readonly Modality[], needed: readonly Modality[]): number {
  return gradedOverlap(needed, datasetModalities, (x, other) =>
    IMAGING.has(x) && other.some((o) => IMAGING.has(o)) ? 0.4 : 0,
  )
}

/** Disease areas: `multi_domain` on either side is a 0.5 partial match. */
export function diseaseOverlap(datasetAreas: readonly DiseaseArea[], needed: readonly DiseaseArea[]): number {
  return gradedOverlap(needed, datasetAreas, (_x, other) => (other.includes("multi_domain") ? 0.5 : 0))
}

// ---------------------------------------------------------------------------
// Per-dimension ratios (best dataset wins where multiple exist)
// ---------------------------------------------------------------------------

function bestOver(datasets: readonly Dataset[], f: (d: Dataset) => number): number {
  return datasets.reduce((best, d) => Math.max(best, f(d)), 0)
}

function diseaseRatio(datasets: readonly Dataset[], needs: DataNeeds, aiSide: Profile): number {
  if (needs.disease_area.length === 0) return 0.5
  // The AI side's multi_domain expertise also grants the 0.5 floor.
  const aiMultiDomain =
    "domain_expertise" in aiSide && (aiSide.domain_expertise as string[]).includes("multi_domain")
  const best = bestOver(datasets, (d) => diseaseOverlap(d.disease_area, needs.disease_area))
  return aiMultiDomain ? Math.max(best, 0.5) : best
}

function modalityRatio(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (needs.modality.length === 0) return 0.5
  return bestOver(datasets, (d) => modalityOverlap(d.modality, needs.modality))
}

/**
 * Access-model compatibility, graded — not pass/fail. Full marks when the
 * team's capability exactly matches the holder's constraint; partial when
 * workable with effort. The hard-block case (export-only team vs locked
 * data) is handled in blockers.ts; here it simply earns 0.
 */
export function accessModelRatio(dataset: Dataset, capabilities: readonly string[]): number {
  const caps = new Set(capabilities)
  const locked =
    dataset.access_model === "secure_processing_environment_only" ||
    dataset.access_model === "federated_no_movement" ||
    dataset.data_can_leave_institution === "no"

  if (dataset.access_model === "undecided") return 0.5

  if (dataset.access_model === "synthetic_derivative_only") {
    // Synthetic derivatives travel freely; exact fit for synthetic-first teams.
    return caps.has("synthetic_only") ? 1 : 0.8
  }

  if (!locked) {
    // open_download / registered_access / dua_required with movable data:
    // any capability profile can work with this.
    return 1
  }

  // The data stays put. What can the team do about it?
  const wantsSpe = dataset.access_model === "secure_processing_environment_only"
  const wantsFederated = dataset.access_model === "federated_no_movement"

  if (wantsSpe && caps.has("can_work_in_tre")) return 1
  if (wantsFederated && caps.has("federated_capable")) return 1
  // The mirror capability is workable with effort.
  if (caps.has("can_work_in_tre") || caps.has("federated_capable")) return 0.6
  if (caps.has("on_prem_only")) return 0.4
  if (caps.has("differential_privacy") || caps.has("synthetic_only")) return 0.3
  // Unknown or export-only capability against locked data.
  return caps.has("requires_data_export") ? 0 : 0.3
}

function accessRatio(datasets: readonly Dataset[], aiSide: Profile): number {
  const caps = "privacy_capability" in aiSide ? (aiSide.privacy_capability as string[]) : []
  return bestOver(datasets, (d) => accessModelRatio(d, caps))
}

/** Full at or above the minimum bucket, half one below, zero at two below. */
export function scaleRatio(datasets: readonly Dataset[], needs: DataNeeds): number {
  if (!needs.min_n_subjects) return 0.5
  const required = nSubjectsRank(needs.min_n_subjects)
  const best = Math.max(...datasets.map((d) => nSubjectsRank(d.n_subjects)))
  if (best >= required) return 1
  if (best === required - 1) return 0.5
  return 0
}

const ANNOTATION_RANK = (a: Annotation) => ANNOTATION.indexOf(a)

function annotationLinkageRatio(datasets: readonly Dataset[], needs: DataNeeds): number {
  // Annotation half: dataset meets the required level → 1, one level short → 0.5.
  let annotation = 0.5
  if (needs.annotation_required && needs.annotation_required !== "none") {
    const required = ANNOTATION_RANK(needs.annotation_required)
    const best = Math.max(...datasets.map((d) => ANNOTATION_RANK(d.annotation)))
    annotation = best >= required ? 1 : best === required - 1 ? 0.5 : 0
  }

  // Linkage half: the fraction of required linkages actually present.
  let linkage = 0.5
  if (needs.linkage_required.length > 0) {
    const present = new Set(datasets.flatMap((d) => d.linkage))
    const hits = needs.linkage_required.filter((l) => present.has(l)).length
    linkage = hits / needs.linkage_required.length
  }

  return (annotation + linkage) / 2
}

/** Raw data needs hands; ai_ready is full marks regardless of team size. */
export function readinessRatio(datasets: readonly Dataset[], aiSide: Profile): number {
  const tiny = "team_size" in aiSide && teamSizeRank(aiSide.team_size) <= 0
  return bestOver(datasets, (d) => {
    switch (d.readiness) {
      case "benchmark_ready":
      case "ai_ready":
        return 1
      case "partially_curated":
        return tiny ? 0.4 : 0.6
      case "raw":
        return tiny ? 0.05 : 0.3
    }
  })
}

function colocationRatio(a: Profile, b: Profile): number {
  if (a.country === b.country) return 1
  const sharedEvent = a.attending.some((e) => e !== "remote_only" && b.attending.includes(e))
  return sharedEvent ? 1 : 0
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function pts(weight: number, ratio: number): number {
  return Math.round(weight * Math.max(0, Math.min(1, ratio)) * 10) / 10
}

/** Compute all soft factors for an oriented pairing. */
export function computeFactors(sides: PairingSides): Factor[] {
  const { datasets, needs, dataSide, aiSide } = sides

  const disease = diseaseRatio(datasets, needs, aiSide)
  const modality = modalityRatio(datasets, needs)
  const access = accessRatio(datasets, aiSide)
  const scale = scaleRatio(datasets, needs)
  const annotationLinkage = annotationLinkageRatio(datasets, needs)
  const readiness = readinessRatio(datasets, aiSide)
  const language = overlaps(dataSide.languages, aiSide.languages) ? 1 : 0
  const colocation = colocationRatio(dataSide, aiSide)

  return [
    { key: "disease_area_fit", weight: 25, earned: pts(25, disease), note: diseaseNote(disease) },
    { key: "modality_fit", weight: 22, earned: pts(22, modality), note: modalityNote(modality) },
    { key: "access_model_fit", weight: 18, earned: pts(18, access), note: accessNote(access) },
    { key: "scale_fit", weight: 10, earned: pts(10, scale), note: scaleNote(scale) },
    {
      key: "annotation_linkage_fit",
      weight: 10,
      earned: pts(10, annotationLinkage),
      note:
        annotationLinkage >= 0.75
          ? "Annotation and linkage requirements are met."
          : annotationLinkage >= 0.4
            ? "Annotation or linkage requirements are partially met."
            : "The dataset lacks the annotation or linkage the team requires.",
    },
    {
      key: "readiness_capacity_fit",
      weight: 6,
      earned: pts(6, readiness),
      note:
        readiness >= 1
          ? "Data is AI-ready."
          : readiness >= 0.4
            ? "Data needs curation the team can plausibly absorb."
            : "Raw data against a small team — expect significant preparation work.",
    },
    {
      key: "language_fit",
      weight: 5,
      earned: pts(5, language),
      note: language ? "Shared working language." : "No shared working language listed.",
    },
    {
      key: "colocation_fit",
      weight: 4,
      earned: pts(4, colocation),
      note: colocation ? "Same country or attending the same event." : "No shared location or event.",
    },
  ]
}

function diseaseNote(r: number): string {
  if (r >= 0.75) return "Clinical domain lines up well."
  if (r >= 0.4) return "Partial clinical domain overlap."
  return "Limited clinical domain overlap."
}
function modalityNote(r: number): string {
  if (r >= 0.75) return "Strong modality match with the team's stated needs."
  if (r >= 0.35) return "Partial modality overlap (related modalities)."
  return "Little or no modality overlap."
}
function accessNote(r: number): string {
  if (r >= 1) return "The team's capability exactly matches the dataset's access constraint."
  if (r >= 0.5) return "Workable access pathway, with some governance effort."
  return "Access constraint and team capability are far apart."
}
function scaleNote(r: number): string {
  if (r >= 1) return "Cohort meets or exceeds the team's minimum size."
  if (r >= 0.5) return "Cohort is one size bucket below the team's minimum."
  return "Cohort is well below the team's minimum size."
}

export function sumFactors(factors: readonly Factor[]): number {
  return Math.round(factors.reduce((acc, f) => acc + f.earned, 0))
}

function statedOverlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0.5
  return jaccard(a, b)
}

function teamWantsPerson(team: PeoplePairingSides["team"]): boolean {
  if (team.looking_for.includes("individual_expert")) return true
  return team.kind === "consortium" && team.still_seeking.includes("individual_expert")
}

/**
 * Soft factors for a person joining a team. Weights sum to 100. Unstated
 * lists score 0.5 so they neither reward nor punish.
 */
export function computePeopleFactors(sides: PeoplePairingSides): Factor[] {
  const { person, team } = sides
  const domain = statedOverlap(person.domain_expertise, team.domain_expertise)
  const methods = statedOverlap(person.methods, team.methods)
  const target = statedOverlap(person.application_target, team.application_target)
  const privacy = statedOverlap(person.privacy_capability, team.privacy_capability)
  const language = overlaps(person.languages, team.languages) ? 1 : 0
  const colocation = colocationRatio(person, team)
  const seeking = teamWantsPerson(team) && person.looking_for.includes("join_team")
    ? 1
    : teamWantsPerson(team) || person.looking_for.includes("join_team")
      ? 0.75
      : 0.5

  return [
    {
      key: "domain_expertise_fit",
      weight: 28,
      earned: pts(28, domain),
      note: domain >= 0.75 ? "Clinical domain lines up well." : domain >= 0.4 ? "Partial clinical domain overlap." : "Limited clinical domain overlap.",
    },
    {
      key: "methods_fit",
      weight: 22,
      earned: pts(22, methods),
      note: methods >= 0.75 ? "Methods overlap strongly." : methods >= 0.4 ? "Some shared methods." : "Little method overlap.",
    },
    {
      key: "application_target_fit",
      weight: 18,
      earned: pts(18, target),
      note: target >= 0.75 ? "Application targets align." : target >= 0.4 ? "Partial target overlap." : "Different application targets.",
    },
    {
      key: "privacy_fit",
      weight: 12,
      earned: pts(12, privacy),
      note: privacy >= 0.75 ? "Privacy capabilities overlap." : privacy >= 0.4 ? "Partial privacy overlap." : "Privacy capabilities differ.",
    },
    {
      key: "language_fit",
      weight: 8,
      earned: pts(8, language),
      note: language ? "Shared working language." : "No shared working language listed.",
    },
    {
      key: "colocation_fit",
      weight: 7,
      earned: pts(7, colocation),
      note: colocation ? "Same country or attending the same event." : "No shared location or event.",
    },
    {
      key: "seeking_fit",
      weight: 5,
      earned: pts(5, seeking),
      note: seeking >= 1
        ? "The team is seeking an individual and the person wants to join a team."
        : seeking >= 0.75
          ? "One side has marked the join-a-team intent."
          : "Join-a-team intent is not yet marked.",
    },
  ]
}
