import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { finalizeGolden } from "./finalize-golden"
import { profileSchema } from "./profile"

/**
 * Validate every checked-in seed file against the Zod schema. Used by the
 * §9 step-1 checkpoint and by CI. Exits non-zero on any failure.
 *
 * Run: pnpm --filter @rmm/schema validate-seed
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const SEED_DIR = resolve(__dirname, "../../../seed")

const bulkFiles = ["data-holders.json", "ai-teams.json", "consortia.json"]
const finalizedDirs = [
  { label: "golden", files: ["data-holders.json", "ai-teams.json"] },
  { label: "operators", files: ["ai-teams.json", "data-holders.json"] },
] as const

let total = 0
let failures = 0

for (const file of bulkFiles) {
  const path = resolve(SEED_DIR, file)
  const records = JSON.parse(readFileSync(path, "utf8")) as unknown[]
  for (const [i, record] of records.entries()) {
    total++
    const result = profileSchema.safeParse(record)
    if (!result.success) {
      failures++
      // eslint-disable-next-line no-console
      console.error(`FAIL ${file}[${i}]:`, JSON.stringify(result.error.issues, null, 2))
    }
  }
}

for (const { label, files } of finalizedDirs) {
  for (const file of files) {
    const path = resolve(SEED_DIR, label, file)
    if (!existsSync(path)) continue
    const records = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[]
    for (const [i, record] of records.entries()) {
      total++
      try {
        finalizeGolden(record)
      } catch (e) {
        failures++
        // eslint-disable-next-line no-console
        console.error(`FAIL ${label}/${file}[${i}]:`, e)
      }
    }
  }
}

if (failures > 0) {
  // eslint-disable-next-line no-console
  console.error(`\n${failures}/${total} seed records failed validation`)
  process.exit(1)
}

// eslint-disable-next-line no-console
console.log(`OK — all ${total} seed records validate against profile schema v1`)
