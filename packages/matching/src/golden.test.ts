import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { finalizeGolden, toPublicProfile, type Profile } from "@rmm/schema"
import { score, topMatches, hasHardBlocker } from "./index"
import { buildAiTeam, buildDataHolder } from "./__fixtures__/build"

/**
 * Golden fixture assertions — the hand-authored test matrix in seed/golden/.
 * If these fail, the matching engine is lying about European health-data
 * reality. Do not weaken them to make the suite green.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const GOLDEN_DIR = resolve(__dirname, "../../../seed/golden")

function loadGolden(file: string): Profile[] {
  const raw = JSON.parse(readFileSync(resolve(GOLDEN_DIR, file), "utf8")) as Record<string, unknown>[]
  return raw.map((r) => finalizeGolden(r))
}

function bySlug(profiles: Profile[], slug: string): Profile {
  const p = profiles.find((x) => x.slug === slug)
  if (!p) throw new Error(`Missing golden profile: ${slug}`)
  return p
}

describe("golden fixtures — access model", () => {
  const holders = loadGolden("data-holders.json")
  const teams = loadGolden("ai-teams.json")

  const ukn = bySlug(holders, "ukn-dic-nordharz")
  const rpaz = bySlug(holders, "rpaz-zuid")
  const garonne = bySlug(holders, "chr-garonne-imagerie")
  const elbe = bySlug(teams, "elbe-vision-lab")
  const neuro = bySlug(teams, "federation-neuro-ia-lyon")

  it("Elbe × UKN: perfect domain, HARD-BLOCKED by access model", () => {
    const result = score(ukn, elbe)
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "access_model_incompatible" && b.severity === "hard")).toBe(true)
  })

  it("Elbe × RPAZ: near-perfect histopath match (the star pairing)", () => {
    const result = score(rpaz, elbe)
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(hasHardBlocker(result.blockers)).toBe(false)
  })

  it("Neuro-IA × Garonne: federated_no_movement scores FULL access-model marks", () => {
    const result = score(garonne, neuro)
    expect(hasHardBlocker(result.blockers)).toBe(false)
    const access = result.factors.find((f) => f.key === "access_model_fit")
    expect(access).toBeDefined()
    expect(access!.earned).toBe(access!.weight)
    expect(result.score).toBeGreaterThanOrEqual(70)
  })

  it("Elbe is hard-blocked against Garonne too (export vs federated)", () => {
    const result = score(garonne, elbe)
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "access_model_incompatible")).toBe(true)
  })
})

describe("golden fixtures — eligibility geography", () => {
  const holders = loadGolden("data-holders.json")
  const teams = loadGolden("ai-teams.json")

  it("Switzerland (ISEA) is eligible", () => {
    expect(bySlug(holders, "isea-alpenraum").eligible_hq).toBe(true)
  })

  it("United Kingdom (Sentinel) is eligible", () => {
    expect(bySlug(teams, "sentinel-health-analytics").eligible_hq).toBe(true)
  })

  it("Israel (Aleph) is eligible", () => {
    expect(bySlug(teams, "aleph-genomics-negev").eligible_hq).toBe(true)
  })

  it("Meridian (US) is NOT eligible HQ but is partner_only — matchable, not hard-blocked", () => {
    const meridian = bySlug(teams, "meridian-clinical-ai")
    const rpaz = bySlug(holders, "rpaz-zuid")
    expect(meridian.eligible_hq).toBe(false)
    expect(meridian.partner_only).toBe(true)

    const result = score(rpaz, meridian)
    expect(hasHardBlocker(result.blockers)).toBe(false)
    expect(result.blockers.some((b) => b.key.endsWith("partner_only") && b.severity === "soft")).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it("two partner_only orgs with no eligible lead hard-block", () => {
    const holder = buildDataHolder({ country: "US", eligible_hq: false, partner_only: true })
    const team = buildAiTeam({ country: "US", eligible_hq: false, partner_only: true })
    const result = score(holder, team)
    expect(result.score).toBe(0)
    expect(result.blockers.some((b) => b.key === "no_eligible_lead")).toBe(true)
  })
})

describe("golden fixtures — soft blockers and scale", () => {
  const holders = loadGolden("data-holders.json")
  const teams = loadGolden("ai-teams.json")

  it("Aurora available_from after Stage 1 surfaces as a soft timeline warning", () => {
    const aurora = bySlug(holders, "aurora-registry-node")
    const sentinel = bySlug(teams, "sentinel-health-analytics")
    const result = score(aurora, sentinel)
    expect(hasHardBlocker(result.blockers)).toBe(false)
    expect(result.blockers.some((b) => b.key === "available_from_after_stage1" && b.severity === "soft")).toBe(
      true,
    )
    expect(result.score).toBeGreaterThan(0)
  })

  it("ISEA (n<1k) × Aleph (needs 10k+): high score with graded scale penalty", () => {
    const isea = bySlug(holders, "isea-alpenraum")
    const aleph = bySlug(teams, "aleph-genomics-negev")
    const result = score(isea, aleph)
    expect(hasHardBlocker(result.blockers)).toBe(false)
    const scale = result.factors.find((f) => f.key === "scale_fit")
    expect(scale).toBeDefined()
    expect(scale!.earned).toBeLessThan(scale!.weight)
    // Domain fit should still keep the total high.
    expect(result.score).toBeGreaterThanOrEqual(50)
  })
})

describe("golden fixtures — redaction of non-public datasets", () => {
  const holders = loadGolden("data-holders.json")
  const isea = bySlug(holders, "isea-alpenraum")

  it("ISEA's private dataset never leaks n_subjects / volume / governance_notes publicly", () => {
    const pub = toPublicProfile(isea) as { datasets?: unknown[] }
    expect(pub.datasets ?? []).toHaveLength(0)
    const json = JSON.stringify(pub)
    expect(json).not.toContain("governance_notes")
    expect(json).not.toContain("lt_1k")
    expect(json).not.toContain("100gb_1tb")
  })
})

describe("golden fixtures — shortlist sanity", () => {
  const holders = loadGolden("data-holders.json")
  const teams = loadGolden("ai-teams.json")
  const all = [...holders, ...teams]

  it("RPAZ's top match includes Elbe (exportable histopath star)", () => {
    const rpaz = bySlug(holders, "rpaz-zuid")
    const matches = topMatches(rpaz, all)
    expect(matches.map((m) => m.otherId)).toContain(bySlug(teams, "elbe-vision-lab").id)
  })

  it("UKN's shortlist does not include Elbe (hard-blocked)", () => {
    const ukn = bySlug(holders, "ukn-dic-nordharz")
    const matches = topMatches(ukn, all)
    expect(matches.map((m) => m.otherId)).not.toContain(bySlug(teams, "elbe-vision-lab").id)
  })
})
