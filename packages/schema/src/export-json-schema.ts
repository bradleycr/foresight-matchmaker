import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { zodToJsonSchema } from "zod-to-json-schema"
import { profileSchema } from "./profile"
import { datasetSchema } from "./dataset"
import { SCHEMA_VERSION } from "./index"

/**
 * Generate versioned JSON Schema from the Zod definitions and write it to the
 * web app's public folder. This file is the contract external tools build
 * against — an MCP server or federated mirror needs nothing more than this
 * plus GET /api/v1/directory.json.
 *
 * Run: pnpm --filter @rmm/schema export-json-schema
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
// packages/schema/src -> repo root -> apps/web/public/schema/v1
const OUT_DIR = resolve(__dirname, "../../../apps/web/public/schema", SCHEMA_VERSION)

function writeSchema(name: string, schema: object) {
  const target = resolve(OUT_DIR, `${name}.schema.json`)
  writeFileSync(target, JSON.stringify(schema, null, 2) + "\n", "utf8")
  // eslint-disable-next-line no-console
  console.log(`wrote ${target}`)
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  const profileJsonSchema = zodToJsonSchema(profileSchema, {
    name: "Profile",
    $refStrategy: "none",
  })
  const datasetJsonSchema = zodToJsonSchema(datasetSchema, {
    name: "Dataset",
    $refStrategy: "none",
  })

  writeSchema("profile", {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://foresightmatchmaker.app/schema/${SCHEMA_VERSION}/profile.schema.json`,
    title: `Foresight Matchmaking — Profile (${SCHEMA_VERSION})`,
    ...profileJsonSchema,
  })

  writeSchema("dataset", {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://foresightmatchmaker.app/schema/${SCHEMA_VERSION}/dataset.schema.json`,
    title: `Foresight Matchmaking — Dataset (${SCHEMA_VERSION})`,
    ...datasetJsonSchema,
  })
}

main()
