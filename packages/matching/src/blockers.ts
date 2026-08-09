import type { Profile, Dataset, DataNeeds, Blocker, PairingSides } from "./types.js"
import { consortiumIsSeeking } from "./helpers.js"

/**
 * Hard and soft blockers for a candidate pairing.
 *
 * Hard blockers zero the score and are returned with `severity: "hard"`.
 * Soft blockers do NOT zero the score — they are surfaced to the user so the
 * friction is visible ("strong match, but the data cannot leave the
 * institution and your team has not indicated TRE experience"). That friction
 * data is the actual research output SPRIND wants, so it is displayed, never
 * hidden.
 */

/** Would this dataset require the data to stay put (no export)? */
function datasetRequiresNoExport(d: Dataset): boolean {
  return (
    d.access_model === "federated_no_movement" ||
    d.access_model === "secure_processing_environment_only" ||
    d.data_can_leave_institution === "no"
  )
}

/** Team can only work by exporting data, with no TRE/federated alternative. */
function teamOnlyExports(needsSideAiCaps: readonly string[]): boolean {
  const caps = new Set(needsSideAiCaps)
  return (
    caps.has("requires_data_export") &&
    !caps.has("can_work_in_tre") &&
    !caps.has("federated_capable")
  )
}

function aiCapabilitiesOf(p: Profile): readonly string[] {
  if (p.kind === "ai_team" || p.kind === "consortium") return p.privacy_capability
  return []
}

/**
 * Per-profile blockers that apply regardless of orientation. Returned so both
 * a and b can be checked.
 */
function profileHardBlockers(p: Profile, label: "a" | "b"): Blocker[] {
  const out: Blocker[] = []
  if (p.open_to_intros === false) {
    out.push({ key: `${label}.open_to_intros`, severity: "hard", note: "This profile is not open to introductions." })
  }
  if (p.visibility === "hidden") {
    out.push({ key: `${label}.visibility_hidden`, severity: "hard", note: "This profile is hidden." })
  }
  if (p.eligible_hq === false) {
    out.push({
      key: `${label}.eligible_hq`,
      severity: "hard",
      note: "Headquarters is outside the eligible region (EU, EFTA, UK, or Israel).",
    })
  }
  if (p.parallel_public_funding === "yes") {
    out.push({
      key: `${label}.parallel_public_funding`,
      severity: "hard",
      note: "This work is funded in parallel by other public sources, which the challenge does not allow.",
    })
  }
  if (p.application_status === "not_applying" || p.application_status === "team_complete") {
    out.push({
      key: `${label}.application_status`,
      severity: "hard",
      note:
        p.application_status === "not_applying"
          ? "This profile is not applying."
          : "This team is already complete.",
    })
  }
  return out
}

/**
 * Access-model incompatibility. Hard when EVERY relevant dataset requires the
 * data to stay put AND the AI team can only work by exporting. If any single
 * dataset is workable, it is not a hard block — but if some datasets are
 * export-blocked we still surface a soft blocker so the friction is visible.
 */
function accessModelBlockers(datasets: readonly Dataset[], aiSide: Profile): Blocker[] {
  const caps = aiCapabilitiesOf(aiSide)
  if (!teamOnlyExports(caps)) return []

  const noExport = datasets.filter(datasetRequiresNoExport)
  if (noExport.length === 0) return []

  if (noExport.length === datasets.length) {
    return [
      {
        key: "access_model_incompatible",
        severity: "hard",
        note:
          "The dataset(s) cannot leave the institution (SPE-only or federated), and the AI team requires data export without TRE or federated capability.",
      },
    ]
  }
  // Some but not all datasets are export-blocked.
  return [
    {
      key: "access_model_partial",
      severity: "soft",
      note:
        "At least one dataset cannot leave the institution, and the AI team has indicated it requires data export. A workable subset may exist, but governance will need attention.",
    },
  ]
}

/**
 * Soft blockers that inform the user without zeroing the score.
 */
function softBlockers(sides: PairingSides): Blocker[] {
  const out: Blocker[] = []
  const { datasets, aiSide, needs } = sides
  const caps = new Set(aiCapabilitiesOf(aiSide))

  const anyNoExport = datasets.some(datasetRequiresNoExport)
  const teamMentionsExport = caps.has("requires_data_export")
  const teamHasTreOrFederated = caps.has("can_work_in_tre") || caps.has("federated_capable")

  if (anyNoExport && !teamHasTreOrFederated && !teamMentionsExport) {
    out.push({
      key: "tre_unconfirmed",
      severity: "soft",
      note:
        "This data cannot leave the institution, and the team has not indicated TRE or federated capability. Confirm the secure-processing pathway before an introduction.",
    })
  }

  const ethicsPending = datasets.some(
    (d) => d.ethics_approval === "not_started" || d.ethics_approval === "in_progress",
  )
  if (ethicsPending) {
    out.push({
      key: "ethics_pending",
      severity: "soft",
      note: "Ethics approval for at least one dataset is not yet in place.",
    })
  }

  if (aiSide.kind === "ai_team" || aiSide.kind === "consortium") {
    if (aiSide.clinical_partner === "need") {
      out.push({
        key: "clinical_partner_needed",
        severity: "soft",
        note: "The AI team still needs a clinical partner, which this data holder may or may not provide.",
      })
    }
  }

  return out
}

/** All same-kind and per-profile hard blockers, plus a null-orientation guard. */
export function structuralHardBlockers(a: Profile, b: Profile, oriented: PairingSides | null): Blocker[] {
  const out: Blocker[] = []

  if (a.kind === b.kind && a.kind !== "consortium") {
    out.push({
      key: "same_kind",
      severity: "hard",
      note: "Both profiles are the same kind; a data holder and an AI team (or a consortium) are needed.",
    })
  }

  if (oriented === null) {
    out.push({
      key: "no_pairing",
      severity: "hard",
      note: "No valid data/AI pairing exists between these two profiles.",
    })
  }

  // Consortium not in the market.
  if (!consortiumIsSeeking(a)) {
    out.push({ key: "a.consortium_complete", severity: "hard", note: "This consortium is not currently seeking partners." })
  }
  if (!consortiumIsSeeking(b)) {
    out.push({ key: "b.consortium_complete", severity: "hard", note: "This consortium is not currently seeking partners." })
  }

  out.push(...profileHardBlockers(a, "a"))
  out.push(...profileHardBlockers(b, "b"))
  return out
}

/**
 * Compute every blocker (hard + soft) for a candidate pairing.
 * `oriented` may be null when no data/AI pairing exists.
 */
export function computeBlockers(a: Profile, b: Profile, oriented: PairingSides | null): Blocker[] {
  const out: Blocker[] = [...structuralHardBlockers(a, b, oriented)]

  if (oriented) {
    out.push(...accessModelBlockers(oriented.datasets, oriented.aiSide))
    out.push(...softBlockers(oriented))
  }

  // De-duplicate by key, keeping the most severe.
  const byKey = new Map<string, Blocker>()
  for (const b2 of out) {
    const existing = byKey.get(b2.key)
    if (!existing || (existing.severity === "soft" && b2.severity === "hard")) {
      byKey.set(b2.key, b2)
    }
  }
  return [...byKey.values()]
}

export function hasHardBlocker(blockers: readonly Blocker[]): boolean {
  return blockers.some((b) => b.severity === "hard")
}

export { datasetRequiresNoExport, teamOnlyExports }
