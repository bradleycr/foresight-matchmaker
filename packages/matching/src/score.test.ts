import { describe, it, expect } from "vitest"
import { score, topMatches } from "./score.js"
import { computeBlockers } from "./blockers.js"
import { orientPairing } from "./pairing.js"
import { jaccard, overlaps } from "./helpers.js"
import {
  buildDataHolder,
  buildAiTeam,
  buildConsortium,
  buildDataset,
  buildNeeds,
} from "./__fixtures__/build.js"

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
    const co = buildConsortium()
    const ai = buildAiTeam()
    expect(orientPairing(co, ai)).not.toBeNull()
  })
})

describe("score — happy path", () => {
  it("a well-matched data_holder / ai_team scores high with no hard blockers", () => {
    const result = score(buildDataHolder(), buildAiTeam())
    expect(result.score).toBeGreaterThan(70)
    expect(result.blockers.filter((b) => b.severity === "hard")).toHaveLength(0)
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
})

describe("score — hard blockers force 0", () => {
  it("two data holders (same kind) hard-block", () => {
    const result = score(buildDataHolder(), buildDataHolder())
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "same_kind" && b.severity === "hard")).toBe(true)
  })

  it("ineligible HQ hard-blocks", () => {
    const dh = buildDataHolder({ eligible_hq: false, country: "US" } as never)
    const result = score(dh, buildAiTeam())
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key.endsWith("eligible_hq"))).toBe(true)
  })

  it("not open to intros hard-blocks", () => {
    const ai = buildAiTeam({ open_to_intros: false } as never)
    expect(score(buildDataHolder(), ai).score).toBe(0)
  })

  it("hidden visibility hard-blocks", () => {
    const ai = buildAiTeam({ visibility: "hidden" } as never)
    expect(score(buildDataHolder(), ai).score).toBe(0)
  })

  it("parallel public funding hard-blocks", () => {
    const ai = buildAiTeam({ parallel_public_funding: "yes" } as never)
    expect(score(buildDataHolder(), ai).score).toBe(0)
  })

  it("not_applying status hard-blocks", () => {
    const ai = buildAiTeam({ application_status: "not_applying" } as never)
    expect(score(buildDataHolder(), ai).score).toBe(0)
  })

  it("access-model incompatible (all datasets locked + export-only team) hard-blocks", () => {
    const dh = buildDataHolder({
      datasets: [
        buildDataset({ access_model: "secure_processing_environment_only", data_can_leave_institution: "no" }),
      ],
    } as never)
    const ai = buildAiTeam({ privacy_capability: ["requires_data_export"] } as never)
    const result = score(dh, ai)
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "access_model_incompatible")).toBe(true)
  })
})

describe("score — soft blockers surface friction without zeroing", () => {
  it("TRE unconfirmed is soft and keeps a non-zero score", () => {
    const dh = buildDataHolder({
      datasets: [buildDataset({ access_model: "federated_no_movement", data_can_leave_institution: "no" })],
    } as never)
    const ai = buildAiTeam({ privacy_capability: [] } as never)
    const result = score(dh, ai)
    expect(result.score).toBeGreaterThan(0)
    expect(result.blockers.some((b) => b.key === "tre_unconfirmed" && b.severity === "soft")).toBe(true)
  })

  it("pending ethics approval is a soft blocker", () => {
    const dh = buildDataHolder({
      datasets: [buildDataset({ ethics_approval: "in_progress" })],
    } as never)
    const result = score(dh, buildAiTeam())
    expect(result.score).toBeGreaterThan(0)
    expect(result.blockers.some((b) => b.key === "ethics_pending" && b.severity === "soft")).toBe(true)
  })
})

describe("score — factor sensitivity", () => {
  it("mismatched modality scores lower than matched modality", () => {
    const matched = score(buildDataHolder(), buildAiTeam())
    const dhMismatch = buildDataHolder({
      datasets: [buildDataset({ modality: ["omics_genomics"], disease_area: ["oncology"] })],
    } as never)
    const aiMismatch = buildAiTeam({
      data_needs: buildNeeds({ modality: ["imaging_ct"], disease_area: ["cardiology"] }),
    } as never)
    const mismatched = score(dhMismatch, aiMismatch)
    expect(mismatched.score).toBeLessThan(matched.score)
  })

  it("concept-only readiness scores lower than ready-now", () => {
    const ready = score(buildDataHolder(), buildAiTeam())
    const concept = score(
      buildDataHolder({ datasets: [buildDataset({ readiness: "concept_only" })] } as never),
      buildAiTeam(),
    )
    expect(concept.score).toBeLessThan(ready.score)
  })

  it("factor earned never exceeds its weight", () => {
    const result = score(buildDataHolder(), buildAiTeam())
    for (const f of result.factors) {
      expect(f.earned).toBeGreaterThanOrEqual(0)
      expect(f.earned).toBeLessThanOrEqual(f.weight)
    }
  })

  it("factor weights sum to 100", () => {
    const result = score(buildDataHolder(), buildAiTeam())
    const total = result.factors.reduce((a, f) => a + f.weight, 0)
    expect(total).toBe(100)
  })
})

describe("consortium behaviour", () => {
  it("a consortium with empty still_seeking produces no matches", () => {
    const co = buildConsortium({ still_seeking: [] } as never)
    expect(topMatches(co, [buildAiTeam(), buildDataHolder()])).toHaveLength(0)
  })

  it("a seeking consortium can match an ai_team", () => {
    const co = buildConsortium({ still_seeking: ["ai_partner"] } as never)
    const matches = topMatches(co, [buildAiTeam()])
    expect(matches.length).toBeGreaterThan(0)
  })
})

describe("topMatches ranking", () => {
  it("excludes hard-blocked candidates by default", () => {
    const subject = buildAiTeam()
    const good = buildDataHolder()
    const blocked = buildDataHolder({ eligible_hq: false } as never)
    const matches = topMatches(subject, [good, blocked])
    expect(matches.map((m) => m.otherId)).toContain(good.id)
    expect(matches.map((m) => m.otherId)).not.toContain(blocked.id)
  })

  it("includes blocked candidates when includeBlocked is set", () => {
    const subject = buildAiTeam()
    const blocked = buildDataHolder({ eligible_hq: false } as never)
    const matches = topMatches(subject, [blocked], { includeBlocked: true })
    expect(matches).toHaveLength(1)
    expect(matches[0].score).toBe(0)
  })

  it("respects the limit and sorts descending by score", () => {
    const subject = buildAiTeam()
    const others = [buildDataHolder(), buildDataHolder(), buildDataHolder()]
    const matches = topMatches(subject, others, { limit: 2 })
    expect(matches.length).toBeLessThanOrEqual(2)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score)
    }
  })

  it("never matches a profile against itself", () => {
    const subject = buildAiTeam()
    const matches = topMatches(subject, [subject], { includeBlocked: true })
    expect(matches).toHaveLength(0)
  })
})

describe("computeBlockers always returns every blocker", () => {
  it("returns soft blockers alongside a scoreable pairing", () => {
    const dh = buildDataHolder({ datasets: [buildDataset({ ethics_approval: "not_started" })] } as never)
    const blockers = computeBlockers(dh, buildAiTeam(), orientPairing(dh, buildAiTeam()))
    expect(blockers.some((b) => b.severity === "soft")).toBe(true)
  })
})
