import { getDb } from "./client"
import { profiles, matches, intros, authTokens, events } from "./schema"
import { findSeedDir, seedFromDirectory } from "./seed-core"

/**
 * Truncate every table and reseed from seed/. Shared by `db:reset` and
 * `db:demo` (below).
 *
 * `db:seed` alone is not enough between rehearsals: it only upserts
 * profiles, so intros, events, auth_tokens, and the match cache accumulate
 * rehearsal junk (test introductions, funnel noise) that no amount of
 * reseeding clears on its own.
 */
export function resetAndReseed(): number {
  const db = getDb()
  db.delete(intros).run()
  db.delete(authTokens).run()
  db.delete(events).run()
  db.delete(matches).run()
  db.delete(profiles).run()
  return seedFromDirectory(findSeedDir())
}
