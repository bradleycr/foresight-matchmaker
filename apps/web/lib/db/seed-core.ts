import fs from "node:fs"
import path from "node:path"
import { finalizeGolden, profileSchema, type Profile } from "@rmm/schema"
import { getDb } from "./client"
import { profiles } from "./schema"
import { recomputeAllMatches } from "./matches"

/**
 * Seeding, shared between the CLI (`pnpm db:seed`) and the container
 * bootstrap (instrumentation.ts with SEED_ON_EMPTY=true).
 *
 * Order matters: the hand-authored golden fixtures in seed/golden/ load
 * first (they are the matcher test matrix). The generated bulk in seed/
 * fills out the directory afterwards, skipping any slug already claimed
 * by a golden profile.
 */

const BULK_FILES = ["data-holders.json", "ai-teams.json", "consortia.json"] as const
const GOLDEN_FILES = ["data-holders.json", "ai-teams.json"] as const

/** Walk up from cwd until we find a directory containing seed/. */
export function findSeedDir(): string {
  let dir = process.cwd()
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "seed")
    if (fs.existsSync(path.join(candidate, BULK_FILES[0]))) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error("Could not locate the seed/ directory with synthetic profiles.")
}

function upsertProfile(profile: Profile): void {
  const row = {
    id: profile.id,
    slug: profile.slug,
    kind: profile.kind,
    orgName: profile.org_name,
    orgType: profile.org_type,
    country: profile.country,
    visibility: profile.visibility,
    applicationStatus: profile.application_status,
    completeness: profile.completeness,
    contactEmail: profile.contact_email.toLowerCase(),
    data: JSON.stringify(profile),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    claimedAt: profile.claimed_at ?? null,
  }
  getDb().insert(profiles).values(row).onConflictDoUpdate({ target: profiles.id, set: row }).run()
}

function loadGolden(seedDir: string): Profile[] {
  const goldenDir = path.join(seedDir, "golden")
  if (!fs.existsSync(goldenDir)) return []

  const out: Profile[] = []
  for (const file of GOLDEN_FILES) {
    const filePath = path.join(goldenDir, file)
    if (!fs.existsSync(filePath)) continue
    // turbopackIgnore: seed lives outside the Next bundle.
    const records = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf8")) as Record<
      string,
      unknown
    >[]
    for (const record of records) out.push(finalizeGolden(record))
  }
  return out
}

function loadBulk(seedDir: string, skipSlugs: Set<string>): Profile[] {
  const out: Profile[] = []
  for (const file of BULK_FILES) {
    const records = JSON.parse(
      fs.readFileSync(/* turbopackIgnore: true */ path.join(seedDir, file), "utf8"),
    ) as unknown[]
    for (const record of records) {
      const profile = profileSchema.parse(record)
      if (skipSlugs.has(profile.slug)) continue
      out.push(profile)
    }
  }
  return out
}

/** Validate and upsert every seed profile, then rebuild the match cache. */
export function seedFromDirectory(seedDir: string): number {
  const golden = loadGolden(seedDir)
  const skip = new Set(golden.map((p) => p.slug))
  const bulk = loadBulk(seedDir, skip)

  for (const profile of [...golden, ...bulk]) upsertProfile(profile)

  recomputeAllMatches()
  return golden.length + bulk.length
}

/**
 * First-boot convenience for Docker: if the profiles table is empty and the
 * seed files are present, load them. A populated database is never touched.
 */
export function seedIfEmpty(): void {
  const existing = getDb().select({ id: profiles.id }).from(profiles).limit(1).all()
  if (existing.length > 0) return

  const seedDir = findSeedDir()
  const count = seedFromDirectory(seedDir)
  console.log(`[seed] Empty database — loaded ${count} synthetic profiles from ${seedDir}.`)
}
