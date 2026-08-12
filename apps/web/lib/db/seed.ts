/**
 * Seed CLI. Run with: pnpm --filter @rmm/web db:seed
 *
 * Loads profiles from /seed (golden + operators + bulk). Idempotent:
 * re-running refreshes the same rows by id.
 */
import { findSeedDir, seedFromDirectory } from "./seed-core"

const count = seedFromDirectory(findSeedDir())
console.log(`Seeded ${count} synthetic profiles and rebuilt the match cache.`)
