import { eq, or } from "drizzle-orm"
import { topMatches, type MatchEntry } from "@rmm/matching"
import type { Profile } from "@rmm/schema"
import { getDb } from "./client"
import { matches, profiles } from "./schema"

/**
 * Match cache.
 *
 * Scores are deterministic, so this table is purely a read-time optimisation:
 * profile pages and shortlists read pre-computed rows instead of scoring the
 * whole corpus per request. Rows are recomputed for BOTH directions whenever
 * either party writes (a profile edit changes its matches and everyone
 * else's matches against it).
 *
 * Blocked pairings (score 0) are stored too — the admin blocker-frequency
 * histogram is built from them. Shortlist reads filter them out.
 */

/** Interactive shortlist cutoff — same number the empty-state copy quotes. */
export const MIN_SCORE = 35

export interface CachedMatch extends MatchEntry {
  computedAt: string
}

function loadAll(): Profile[] {
  return getDb()
    .select({ data: profiles.data })
    .from(profiles)
    .all()
    .map((r) => JSON.parse(r.data) as Profile)
}

/** Recompute every cached pairing that involves `profileId`. */
export function recomputeMatchesFor(profileId: string): void {
  const db = getDb()
  const all = loadAll()
  const subject = all.find((p) => p.id === profileId)
  if (!subject) return

  const now = new Date().toISOString()
  const rows: (typeof matches.$inferInsert)[] = []

  // Outgoing: subject → everyone. includeBlocked keeps score-0 rows so the
  // admin histogram can count which blockers kill otherwise-viable pairs.
  for (const entry of topMatches(subject, all, { limit: all.length, includeBlocked: true })) {
    rows.push({
      subjectId: subject.id,
      otherId: entry.otherId,
      score: entry.score,
      factors: JSON.stringify(entry.factors),
      blockers: JSON.stringify(entry.blockers),
      computedAt: now,
    })
  }

  // Incoming: everyone → subject. Scoring is symmetric in outcome but each
  // side owns its own shortlist rows.
  for (const other of all) {
    if (other.id === subject.id) continue
    for (const entry of topMatches(other, [subject], { limit: 1, includeBlocked: true })) {
      rows.push({
        subjectId: other.id,
        otherId: subject.id,
        score: entry.score,
        factors: JSON.stringify(entry.factors),
        blockers: JSON.stringify(entry.blockers),
        computedAt: now,
      })
    }
  }

  db.transaction((tx) => {
    tx.delete(matches)
      .where(or(eq(matches.subjectId, profileId), eq(matches.otherId, profileId)))
      .run()
    for (const row of rows) tx.insert(matches).values(row).run()
  })
}

/** Rebuild the whole cache (used by the seed loader). */
export function recomputeAllMatches(): void {
  const db = getDb()
  const all = loadAll()
  const now = new Date().toISOString()

  db.transaction((tx) => {
    tx.delete(matches).run()
    for (const subject of all) {
      for (const entry of topMatches(subject, all, { limit: all.length, includeBlocked: true })) {
        tx.insert(matches)
          .values({
            subjectId: subject.id,
            otherId: entry.otherId,
            score: entry.score,
            factors: JSON.stringify(entry.factors),
            blockers: JSON.stringify(entry.blockers),
            computedAt: now,
          })
          .run()
      }
    }
  })
}

/** Ranked shortlist for one profile: score ≥ 35, unblocked, best first. */
export function getShortlist(subjectId: string): CachedMatch[] {
  return getDb()
    .select()
    .from(matches)
    .where(eq(matches.subjectId, subjectId))
    .all()
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.otherId < b.otherId ? -1 : 1))
    .map((r) => ({
      otherId: r.otherId,
      score: r.score,
      factors: JSON.parse(r.factors),
      blockers: JSON.parse(r.blockers),
      computedAt: r.computedAt,
    }))
}

/** Every cached pairing, blocked ones included — admin metrics input. */
export function getAllCachedMatches(): CachedMatch[] {
  return getDb()
    .select()
    .from(matches)
    .all()
    .map((r) => ({
      otherId: r.otherId,
      score: r.score,
      factors: JSON.parse(r.factors),
      blockers: JSON.parse(r.blockers),
      computedAt: r.computedAt,
    }))
}
