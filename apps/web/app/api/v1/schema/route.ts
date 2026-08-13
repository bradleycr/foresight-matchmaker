import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"

/**
 * GET /api/v1/schema — the versioned JSON Schema contract, generated from
 * the Zod definitions by `pnpm schema:export`. Together with
 * `/api/v1/directory.json` (session required) this is the contract a
 * client or agent should build against. See also `/llms.txt` and
 * `/openapi.json`.
 */
export function GET(): NextResponse {
  const file = path.join(process.cwd(), "public", "schema", "v1", "profile.schema.json")
  const schema = JSON.parse(fs.readFileSync(file, "utf8"))
  return NextResponse.json(schema, {
    headers: { "Cache-Control": "public, max-age=3600" },
  })
}
