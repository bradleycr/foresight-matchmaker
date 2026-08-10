/**
 * Seed CLI. Run with: pnpm --filter @rmm/web db:seed
 *
 * Loads the synthetic profiles from /seed/*.json (all data is fabricated —
 * see seed/README.md). Idempotent: re-running refreshes the same rows by id.
 */
import { findSeedDir, seedFromDirectory } from "./seed-core"

const count = seedFromDirectory(findSeedDir())
console.log(`Seeded ${count} synthetic profiles and rebuilt the match cache.`)
