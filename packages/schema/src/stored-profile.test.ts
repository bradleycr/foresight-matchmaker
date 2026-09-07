import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { profileSchema } from "./profile"
import { LEGACY_OTHER_PLACEHOLDER, parseStoredProfile } from "./stored-profile"

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

describe("parseStoredProfile — write schema vs already-published listings", () => {
  it("keeps a data holder listed when modality Other was ticked before the definition was required", () => {
    const holder = loadFirstHolder()
    const datasets = [...((holder.datasets as Record<string, unknown>[]) ?? [])]
    if (datasets[0]) {
      datasets[0] = { ...datasets[0], modality: ["other"], modality_other: "" }
    }
    const stored = { ...holder, datasets }

    expect(profileSchema.safeParse(stored).success).toBe(false)

    const parsed = parseStoredProfile(stored)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.repaired).toBe(true)
    expect(parsed.data.kind).toBe("data_holder")
    if (parsed.data.kind === "data_holder") {
      expect(parsed.data.datasets[0]?.modality_other).toBe(LEGACY_OTHER_PLACEHOLDER)
    }
  })

  it("keeps an AI team listed when data-needs Other was ticked without a definition", () => {
    const stored = {
      ...loadFirstAiTeam(),
      data_needs: {
        ...(loadFirstAiTeam().data_needs as Record<string, unknown>),
        modality: ["other"],
        disease_area: ["other"],
        modality_other: "",
        disease_area_other: undefined,
      },
    }

    expect(profileSchema.safeParse(stored).success).toBe(false)

    const parsed = parseStoredProfile(stored)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.repaired).toBe(true)
    if (parsed.data.kind === "ai_team") {
      expect(parsed.data.data_needs.modality_other).toBe(LEGACY_OTHER_PLACEHOLDER)
      expect(parsed.data.data_needs.disease_area_other).toBe(LEGACY_OTHER_PLACEHOLDER)
    }
  })

  it("does not rewrite a listing that already satisfies the write schema", () => {
    const holder = loadFirstHolder()
    const parsed = parseStoredProfile(holder)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.repaired).toBe(false)
  })

  it("still reports issues that are not a missing Other definition", () => {
    const parsed = parseStoredProfile({ kind: "ai_team", org_name: "Broken" })
    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(parsed.issues.length).toBeGreaterThan(0)
  })
})
