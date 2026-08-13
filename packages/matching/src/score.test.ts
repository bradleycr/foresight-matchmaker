import { describe, it, expect } from "vitest"
import { score, topMatches } from "./score"
import { computeBlockers } from "./blockers"
import { orientPairing, orientPeoplePairing } from "./pairing"
import { jaccard, overlaps } from "./helpers"
import { modalityOverlap, diseaseOverlap, accessModelRatio, scaleRatio, readinessRatio } from "./factors"
import {
  buildDataHolder,
  buildAiTeam,
  buildConsortium,
  buildIndividual,
  buildDataset,
  buildNeeds,
} from "./__fixtures__/build"

function factor(result: ReturnType<typeof score>, key: string) {
  const f = result.factors.find((x) => x.key === key)
  if (!f) throw new Error(`factor ${key} missing`)
  return f
}

describe("helpers", () => {
  it("jaccard of identical sets is 1", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1)
  })
  it("jaccard of disjoint sets is 0", () => {
    expect(jaccard(["a"], ["b"])).toBe(0)
  })
  it("jaccard treats empty as 0", () => {
    expect(jaccard([], ["a"])).toBe(0)
  })
  it("overlaps detects a shared element", () => {
    expect(overlaps(["en", "de"], ["de"])).toBe(true)
    expect(overlaps(["en"], ["de"])).toBe(false)
  })
})

describe("orientPairing", () => {
  it("orients data_holder as data side and ai_team as AI side", () => {
    const dh = buildDataHolder()
    const ai = buildAiTeam()
    const oriented = orientPairing(dh, ai)
    expect(oriented?.dataSide.id).toBe(dh.id)
    expect(oriented?.aiSide.id).toBe(ai.id)
  })
  it("orients regardless of argument order", () => {
    const dh = buildDataHolder()
    const ai = buildAiTeam()
    const oriented = orientPairing(ai, dh)
    expect(oriented?.dataSide.id).toBe(dh.id)
    expect(oriented?.aiSide.id).toBe(ai.id)
  })
  it("returns null for two data holders", () => {
    expect(orientPairing(buildDataHolder(), buildDataHolder())).toBeNull()
  })
  it("orients a consortium against an ai_team", () => {
    expect(orientPairing(buildConsortium(), buildAiTeam())).not.toBeNull()
  })
  it("does not put an individual on the data/AI axis", () => {
    expect(orientPairing(buildDataHolder(), buildIndividual())).toBeNull()
    expect(orientPairing(buildIndividual(), buildAiTeam())).toBeNull()
  })
})

describe("orientPeoplePairing", () => {
  it("orients an individual against an AI team", () => {
    const person = buildIndividual()
    const team = buildAiTeam()
    const oriented = orientPeoplePairing(person, team)
    expect(oriented?.person.id).toBe(person.id)
    expect(oriented?.team.id).toBe(team.id)
  })
  it("orients regardless of argument order", () => {
    const person = buildIndividual()
    const team = buildAiTeam()
    const oriented = orientPeoplePairing(team, person)
    expect(oriented?.person.id).toBe(person.id)
  })
  it("orients an individual against a seeking consortium", () => {
    expect(orientPeoplePairing(buildIndividual(), buildConsortium())).not.toBeNull()
  })
  it("does not orient an individual against a data holder", () => {
    expect(orientPeoplePairing(buildIndividual(), buildDataHolder())).toBeNull()
  })
  it("does not orient an individual against a complete consortium", () => {
    expect(orientPeoplePairing(buildIndividual(), buildConsortium({ still_seeking: [] }))).toBeNull()
  })
})

describe("score — happy path", () => {
  it("a well-matched data_holder / ai_team scores high with no hard blockers", () => {
    const result = score(buildDataHolder(), buildAiTeam())
    expect(result.score).toBeGreaterThan(70)
    expect(result.blockers.filter((b) => b.severity === "hard")).toHaveLength(0)
  })

  it("scores an individual against an AI team with no hard blockers", () => {
    const result = score(buildIndividual(), buildAiTeam())
    expect(result.score).toBeGreaterThan(50)
    expect(result.blockers.filter((b) => b.severity === "hard")).toHaveLength(0)
  })

  it("does not rank an individual against a data holder", () => {
    const result = score(buildDataHolder(), buildIndividual())
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "no_pairing")).toBe(true)
  })

  it("is deterministic — identical inputs give identical output", () => {
    const dh = buildDataHolder()
    const ai = buildAiTeam()
    expect(score(dh, ai)).toEqual(score(dh, ai))
  })

  it("is symmetric in argument order", () => {
    const dh = buildDataHolder()
    const ai = buildAiTeam()
    expect(score(dh, ai).score).toBe(score(ai, dh).score)
  })

  it("never exceeds 100 or drops below 0", () => {
    const result = score(buildDataHolder(), buildAiTeam())
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it("factor weights sum to 100 with the specified distribution", () => {
    const result = score(buildDataHolder(), buildAiTeam())
    const weights = Object.fromEntries(result.factors.map((f) => [f.key, f.weight]))
    expect(weights).toEqual({
      disease_area_fit: 25,
      modality_fit: 22,
      access_model_fit: 18,
      scale_fit: 10,
      annotation_linkage_fit: 10,
      readiness_capacity_fit: 6,
      language_fit: 5,
      colocation_fit: 4,
    })
  })

  it("factor earned never exceeds its weight", () => {
    const result = score(buildDataHolder(), buildAiTeam())
    for (const f of result.factors) {
      expect(f.earned).toBeGreaterThanOrEqual(0)
      expect(f.earned).toBeLessThanOrEqual(f.weight)
    }
  })
})

describe("score — hard blockers force 0", () => {
  it("two data holders (same kind) hard-block", () => {
    const result = score(buildDataHolder(), buildDataHolder())
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "same_kind" && b.severity === "hard")).toBe(true)
  })

  it("two ai teams (same kind) hard-block", () => {
    expect(score(buildAiTeam(), buildAiTeam()).score).toBe(0)
  })

  it("ineligible HQ hard-blocks", () => {
    const dh = buildDataHolder({ eligible_hq: false, country: "US" })
    const result = score(dh, buildAiTeam())
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key.endsWith("eligible_hq"))).toBe(true)
  })

  it("not open to intros hard-blocks", () => {
    expect(score(buildDataHolder(), buildAiTeam({ open_to_intros: false })).score).toBe(0)
  })

  it("hidden visibility hard-blocks", () => {
    expect(score(buildDataHolder(), buildAiTeam({ visibility: "hidden" })).score).toBe(0)
  })

  it("parallel public funding hard-blocks", () => {
    expect(score(buildDataHolder(), buildAiTeam({ parallel_public_funding: "yes" })).score).toBe(0)
  })

  it("not_applying status hard-blocks", () => {
    expect(score(buildDataHolder(), buildAiTeam({ application_status: "not_applying" })).score).toBe(0)
  })

  it("team_complete status hard-blocks", () => {
    expect(score(buildDataHolder(), buildAiTeam({ application_status: "team_complete" })).score).toBe(0)
  })

  it("access-model incompatible (all datasets locked + export-only team) hard-blocks", () => {
    const dh = buildDataHolder({
      datasets: [
        buildDataset({ access_model: "secure_processing_environment_only", data_can_leave_institution: "no" }),
      ],
    })
    const ai = buildAiTeam({ privacy_capability: ["requires_data_export"] })
    const result = score(dh, ai)
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "access_model_incompatible")).toBe(true)
  })

  it("a PERFECT modality-and-domain pair is still blocked by access-model incompatibility", () => {
    // Identical modality and disease area on both sides — a dream pairing on
    // paper — must still be zeroed by governance incompatibility.
    const dh = buildDataHolder({
      datasets: [
        buildDataset({
          modality: ["imaging_mri"],
          disease_area: ["oncology"],
          access_model: "federated_no_movement",
          data_can_leave_institution: "no",
        }),
      ],
    })
    const ai = buildAiTeam({
      privacy_capability: ["requires_data_export"],
      data_needs: buildNeeds({ modality: ["imaging_mri"], disease_area: ["oncology"] }),
    })
    const result = score(dh, ai)
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "access_model_incompatible" && b.severity === "hard")).toBe(true)
  })
})

describe("score — soft blockers surface friction without zeroing", () => {
  it("TRE unconfirmed is soft and keeps a non-zero score", () => {
    const dh = buildDataHolder({
      datasets: [buildDataset({ access_model: "federated_no_movement", data_can_leave_institution: "no" })],
    })
    const ai = buildAiTeam({ privacy_capability: [] })
    const result = score(dh, ai)
    expect(result.score).toBeGreaterThan(0)
    expect(result.blockers.some((b) => b.key === "tre_unconfirmed" && b.severity === "soft")).toBe(true)
  })

  it("pending ethics approval is a soft blocker", () => {
    const dh = buildDataHolder({ datasets: [buildDataset({ ethics_approval: "in_progress" })] })
    const result = score(dh, buildAiTeam())
    expect(result.score).toBeGreaterThan(0)
    expect(result.blockers.some((b) => b.key === "ethics_pending" && b.severity === "soft")).toBe(true)
  })
})

describe("modality overlap — grouped imaging", () => {
  it("identical single modality scores 1", () => {
    expect(modalityOverlap(["imaging_mri"], ["imaging_mri"])).toBe(1)
  })
  it("imaging_mri vs imaging_ct scores 0.4, not 0", () => {
    expect(modalityOverlap(["imaging_mri"], ["imaging_ct"])).toBe(0.4)
  })
  it("unrelated modalities score 0", () => {
    expect(modalityOverlap(["genomics"], ["imaging_ct"])).toBe(0)
  })
})

describe("disease overlap — multi_domain partial", () => {
  it("multi_domain against anything scores 0.5", () => {
    expect(diseaseOverlap(["multi_domain"], ["oncology"])).toBe(0.5)
  })
  it("exact area match scores 1", () => {
    expect(diseaseOverlap(["oncology"], ["oncology"])).toBe(1)
  })
})

describe("access-model grading", () => {
  it("movable data is full marks for any team", () => {
    expect(accessModelRatio(buildDataset({ access_model: "open_download" }), ["requires_data_export"])).toBe(1)
  })
  it("SPE-only data + TRE-capable team is an exact fit", () => {
    const d = buildDataset({ access_model: "secure_processing_environment_only", data_can_leave_institution: "no" })
    expect(accessModelRatio(d, ["can_work_in_tre"])).toBe(1)
  })
  it("SPE-only data + federated-only team is workable with effort", () => {
    const d = buildDataset({ access_model: "secure_processing_environment_only", data_can_leave_institution: "no" })
    expect(accessModelRatio(d, ["federated_capable"])).toBe(0.6)
  })
  it("locked data + export-only team earns 0", () => {
    const d = buildDataset({ access_model: "federated_no_movement", data_can_leave_institution: "no" })
    expect(accessModelRatio(d, ["requires_data_export"])).toBe(0)
  })
  it("undecided access model is neutral", () => {
    expect(accessModelRatio(buildDataset({ access_model: "undecided" }), ["can_work_in_tre"])).toBe(0.5)
  })
})

describe("scale sufficiency boundaries", () => {
  const needs = buildNeeds({ min_n_subjects: "10k_100k" })
  it("at or above the minimum bucket is full marks", () => {
    expect(scaleRatio([buildDataset({ n_subjects: "10k_100k" })], needs)).toBe(1)
    expect(scaleRatio([buildDataset({ n_subjects: "gt_1m" })], needs)).toBe(1)
  })
  it("one bucket below is half marks", () => {
    expect(scaleRatio([buildDataset({ n_subjects: "1k_10k" })], needs)).toBe(0.5)
  })
  it("two buckets below is zero", () => {
    expect(scaleRatio([buildDataset({ n_subjects: "lt_1k" })], needs)).toBe(0)
  })
  it("no stated minimum is neutral", () => {
    expect(scaleRatio([buildDataset({ n_subjects: "lt_1k" })], buildNeeds({ min_n_subjects: undefined }))).toBe(0.5)
  })
})

describe("readiness vs capacity", () => {
  it("ai_ready is full marks regardless of team size", () => {
    const tiny = buildAiTeam({ team_size: "1" })
    expect(readinessRatio([buildDataset({ readiness: "ai_ready" })], tiny)).toBe(1)
  })
  it("raw data with a one-person team scores near zero", () => {
    const tiny = buildAiTeam({ team_size: "1" })
    expect(readinessRatio([buildDataset({ readiness: "raw" })], tiny)).toBeLessThan(0.1)
  })
  it("raw data with a larger team scores low but non-trivially", () => {
    const big = buildAiTeam({ team_size: "gt_15" })
    expect(readinessRatio([buildDataset({ readiness: "raw" })], big)).toBe(0.3)
  })
})

describe("score — factor sensitivity", () => {
  it("mismatched modality and domain scores lower than matched", () => {
    const matched = score(buildDataHolder(), buildAiTeam())
    const mismatched = score(
      buildDataHolder({ datasets: [buildDataset({ modality: ["genomics"], disease_area: ["oncology"] })] }),
      buildAiTeam({ data_needs: buildNeeds({ modality: ["imaging_ct"], disease_area: ["cardiovascular"] }) }),
    )
    expect(mismatched.score).toBeLessThan(matched.score)
  })

  it("raw readiness scores lower than ai_ready", () => {
    const ready = score(buildDataHolder(), buildAiTeam())
    const raw = score(buildDataHolder({ datasets: [buildDataset({ readiness: "raw" })] }), buildAiTeam())
    expect(raw.score).toBeLessThan(ready.score)
  })

  it("no shared language earns zero on language_fit", () => {
    const dh = buildDataHolder({ languages: ["de"] })
    const ai = buildAiTeam({ languages: ["fr"] })
    expect(factor(score(dh, ai), "language_fit").earned).toBe(0)
  })

  it("same country earns full colocation marks", () => {
    const dh = buildDataHolder({ country: "FR", attending: [] })
    const ai = buildAiTeam({ country: "FR", attending: [] })
    expect(factor(score(dh, ai), "colocation_fit").earned).toBe(4)
  })

  it("different country but shared event earns full colocation marks", () => {
    const dh = buildDataHolder({ country: "FR", attending: ["event_sept_1"] })
    const ai = buildAiTeam({ country: "DE", attending: ["event_sept_1"] })
    expect(factor(score(dh, ai), "colocation_fit").earned).toBe(4)
  })

  it("remote_only does not count as a shared event", () => {
    const dh = buildDataHolder({ country: "FR", attending: ["remote_only"] })
    const ai = buildAiTeam({ country: "DE", attending: ["remote_only"] })
    expect(factor(score(dh, ai), "colocation_fit").earned).toBe(0)
  })
})

describe("consortium behaviour", () => {
  it("a consortium with empty still_seeking produces no matches", () => {
    const co = buildConsortium({ still_seeking: [] })
    expect(topMatches(co, [buildAiTeam(), buildDataHolder()])).toHaveLength(0)
  })

  it("a seeking consortium can match an ai_team", () => {
    const co = buildConsortium({ still_seeking: ["ai_partner"] })
    expect(topMatches(co, [buildAiTeam()]).length).toBeGreaterThan(0)
  })
})

describe("topMatches ranking", () => {
  it("excludes hard-blocked candidates by default", () => {
    const subject = buildAiTeam()
    const good = buildDataHolder()
    const blocked = buildDataHolder({ eligible_hq: false })
    const matches = topMatches(subject, [good, blocked])
    expect(matches.map((m) => m.otherId)).toContain(good.id)
    expect(matches.map((m) => m.otherId)).not.toContain(blocked.id)
  })

  it("includes blocked candidates when includeBlocked is set", () => {
    const subject = buildAiTeam()
    const blocked = buildDataHolder({ eligible_hq: false })
    const matches = topMatches(subject, [blocked], { includeBlocked: true })
    expect(matches).toHaveLength(1)
    expect(matches[0]!.score).toBe(0)
  })

  it("respects the limit and sorts descending by score", () => {
    const subject = buildAiTeam()
    const others = [buildDataHolder(), buildDataHolder(), buildDataHolder()]
    const matches = topMatches(subject, others, { limit: 2 })
    expect(matches.length).toBeLessThanOrEqual(2)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1]!.score).toBeGreaterThanOrEqual(matches[i]!.score)
    }
  })

  it("never matches a profile against itself", () => {
    const subject = buildAiTeam()
    expect(topMatches(subject, [subject], { includeBlocked: true })).toHaveLength(0)
  })
})

describe("computeBlockers always returns every blocker", () => {
  it("returns soft blockers alongside a scoreable pairing", () => {
    const dh = buildDataHolder({ datasets: [buildDataset({ ethics_approval: "not_started" })] })
    const blockers = computeBlockers(dh, buildAiTeam(), orientPairing(dh, buildAiTeam()))
    expect(blockers.some((b) => b.severity === "soft")).toBe(true)
  })
})
