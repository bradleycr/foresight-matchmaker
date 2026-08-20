import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { profileSchema, toPublicProfile } from "./profile"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_DIR = resolve(__dirname, "../../../seed")

function loadSeed(file: string): unknown[] {
  const raw = readFileSync(resolve(SEED_DIR, file), "utf8")
  return JSON.parse(raw)
}

const PRIVATE_KEYS = ["contact_name", "contact_role", "governance_notes"]

function deepFindKey(obj: unknown, key: string): boolean {
  if (Array.isArray(obj)) return obj.some((v) => deepFindKey(v, key))
  if (obj && typeof obj === "object") {
    if (key in (obj as Record<string, unknown>)) return true
    return Object.values(obj as Record<string, unknown>).some((v) => deepFindKey(v, key))
  }
  return false
}

describe("redaction", () => {
  const files = ["data-holders.json", "ai-teams.json", "consortia.json"]

  for (const file of files) {
    describe(file, () => {
      const profiles = loadSeed(file).map((p) => profileSchema.parse(p))

      it("every seed profile validates", () => {
        expect(profiles.length).toBeGreaterThan(0)
      })

      it("toPublicProfile strips every private key", () => {
        for (const p of profiles) {
          const pub = toPublicProfile(p)
          for (const key of PRIVATE_KEYS) {
            expect(deepFindKey(pub, key), `${key} leaked in ${p.slug}`).toBe(false)
          }
        }
      })

      it("public payload drops datasets flagged publicly_describable: false", () => {
        for (const p of profiles) {
          const pub = toPublicProfile(p) as { datasets?: Array<{ publicly_describable?: boolean }> }
          if (Array.isArray(pub.datasets)) {
            expect(pub.datasets.every((d) => d.publicly_describable === true)).toBe(true)
          }
        }
      })
    })
  }
})
