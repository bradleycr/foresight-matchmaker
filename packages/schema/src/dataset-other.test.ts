import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { dataNeedsSchema, datasetSchema } from "./dataset"
import { profileSchema } from "./profile"

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../seed")

function loadFirstHolder(): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(resolve(seedDir, "data-holders.json"), "utf8")) as Record<string, unknown>[]
  const first = raw[0]
  if (!first) throw new Error("seed data-holders.json is empty")
  return { ...first }
}

function loadFirstAiTeam(): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(resolve(seedDir, "ai-teams.json"), "utf8")) as Record<string, unknown>[]
  const first = raw[0]
  if (!first) throw new Error("seed ai-teams.json is empty")
  return { ...first }
}

describe("dataset Other please-define fields", () => {
  it("rejects modality Other without a definition", () => {
    const result = datasetSchema.safeParse({
      name: "Test cohort",
      modality: ["other"],
      disease_area: ["oncology"],
      n_subjects: "lt_1k",
      volume: "lt_100gb",
      longitudinal: false,
      annotation: "none",
      linkage: ["none"],
      standards: ["none"],
      readiness: "raw",
      consent_basis: "unclear",
      access_model: "undecided",
      data_can_leave_institution: "unsure",
      ethics_approval: "not_started",
      publicly_describable: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "modality_other")).toBe(true)
    }
  })

  it("accepts modality Other with a definition", () => {
    const result = datasetSchema.safeParse({
      name: "Test cohort",
      modality: ["other"],
      modality_other: "Environmental exposure registry",
      disease_area: ["oncology"],
      n_subjects: "lt_1k",
      volume: "lt_100gb",
      longitudinal: false,
      annotation: "none",
      linkage: ["none"],
      standards: ["none"],
      readiness: "raw",
      consent_basis: "unclear",
      access_model: "undecided",
      data_can_leave_institution: "unsure",
      ethics_approval: "not_started",
      publicly_describable: true,
    })
    expect(result.success).toBe(true)
  })
})

describe("data needs Other please-define fields", () => {
  it("rejects disease area Other without a definition", () => {
    const result = dataNeedsSchema.safeParse({
      modality: [],
      disease_area: ["other"],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "disease_area_other")).toBe(true)
    }
  })
})

describe("profile dataset Other fields", () => {
  it("rejects a data holder whose dataset uses Other without defining it", () => {
    const holder = loadFirstHolder()
    const datasets = [...((holder.datasets as Record<string, unknown>[]) ?? [])]
    if (datasets[0]) {
      datasets[0] = { ...datasets[0], modality: ["other"], modality_other: "" }
    }
    const result = profileSchema.safeParse({ ...holder, datasets })
    expect(result.success).toBe(false)
  })

  it("accepts a data holder whose dataset defines modality Other", () => {
    const holder = loadFirstHolder()
    const datasets = [...((holder.datasets as Record<string, unknown>[]) ?? [])]
    if (datasets[0]) {
      datasets[0] = { ...datasets[0], modality: ["genomics", "other"], modality_other: "Spatial transcriptomics" }
    }
    const result = profileSchema.safeParse({ ...holder, datasets })
    expect(result.success).toBe(true)
  })

  it("rejects an AI team whose data needs use Other without defining it", () => {
    const team = loadFirstAiTeam()
    const result = profileSchema.safeParse({
      ...team,
      data_needs: {
        ...(team.data_needs as Record<string, unknown>),
        modality: ["other"],
        modality_other: "",
      },
    })
    expect(result.success).toBe(false)
  })
})
