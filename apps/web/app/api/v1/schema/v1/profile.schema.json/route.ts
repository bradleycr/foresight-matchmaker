import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"

/**
 * GET /api/v1/schema/v1/profile.schema.json — the exact path promised in the
 * public contract. Serves the same generated JSON Schema as /api/v1/schema.
 * (Kept as a standalone handler: re-exporting route handlers across files
 * breaks Next's route analysis for suffixed segments.)
 */
export function GET(): NextResponse {
  const file = path.join(process.cwd(), "public", "schema", "v1", "profile.schema.json")
  const schema = JSON.parse(fs.readFileSync(file, "utf8"))
  return NextResponse.json(schema, {
    headers: { "Cache-Control": "public, max-age=3600" },
  })
}
