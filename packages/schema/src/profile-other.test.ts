import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { profileSchema } from "./profile"

const seedDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../seed")

function loadFirstHolder(): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(resolve(seedDir, "data-holders.json"), "utf8")) as Record<string, unknown>[]
  const first = raw[0]
  if (!first) throw new Error("seed data-holders.json is empty")
  return { ...first }
}

describe("Other please-define fields", () => {
  it("rejects organisation type Other without a definition", () => {
    const result = profileSchema.safeParse({
      ...loadFirstHolder(),
      org_type: "other",
      org_type_other: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "org_type_other")).toBe(true)
    }
  })

  it("accepts organisation type Other with a definition", () => {
    const result = profileSchema.safeParse({
      ...loadFirstHolder(),
      org_type: "other",
      org_type_other: "Patient advocacy network",
    })
    expect(result.success).toBe(true)
  })

  it("rejects looking-for Other without a definition", () => {
    const result = profileSchema.safeParse({
      ...loadFirstHolder(),
      looking_for: ["other"],
      looking_for_other: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "looking_for_other")).toBe(true)
    }
  })

  it("rejects methods Other without a definition", () => {
    const raw = JSON.parse(readFileSync(resolve(seedDir, "ai-teams.json"), "utf8")) as Record<string, unknown>[]
    const first = raw[0]
    if (!first) throw new Error("seed ai-teams.json is empty")
    const result = profileSchema.safeParse({
      ...first,
      methods: ["other"],
      methods_other: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "methods_other")).toBe(true)
    }
  })

  it("accepts methods Other with a definition", () => {
    const raw = JSON.parse(readFileSync(resolve(seedDir, "ai-teams.json"), "utf8")) as Record<string, unknown>[]
    const first = raw[0]
    if (!first) throw new Error("seed ai-teams.json is empty")
    const result = profileSchema.safeParse({
      ...first,
      methods: ["other"],
      methods_other: "Mechanistic ODE models",
    })
    expect(result.success).toBe(true)
  })
})

describe("visibility default", () => {
  it("defaults omitted visibility to signed-in members, not the open web", () => {
    const { visibility: _dropped, ...rest } = loadFirstHolder()
    expect(profileSchema.parse(rest).visibility).toBe("authenticated_only")
  })
})
