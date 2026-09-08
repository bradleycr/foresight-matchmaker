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
 *
 * Hydrate used to rebuild this table for every profile on every page load.
 * Reads now fill missing rows for the subject that actually needs them.
 */

/** Interactive shortlist cutoff — same number the empty-state copy quotes. */
export const MIN_SCORE = 35

export interface CachedMatch extends MatchEntry {
  subjectId: string
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

  // Incoming: everyone → subject. Each side owns its own shortlist rows.
  // Hidden subjects still receive outgoing matches against visible peers;
  // others do not receive the hidden subject (`score` hard-blocks `b`).
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

function profileIds(): string[] {
  return getDb()
    .select({ id: profiles.id })
    .from(profiles)
    .all()
    .map((r) => r.id)
}

/**
 * Has this profile been scored at all?
 *
 * Deliberately either direction. A consortium that is not seeking produces no
 * outgoing rows by design, so "does it own a shortlist" is not the same
 * question as "has the scorer seen it" — reading the former as a gap made
 * every call rebuild.
 */
function isScored(profileId: string): boolean {
  const row = getDb()
    .select({ id: matches.subjectId })
    .from(matches)
    .where(or(eq(matches.subjectId, profileId), eq(matches.otherId, profileId)))
    .limit(1)
    .get()
  return Boolean(row)
}

/** Ranked shortlist for one profile: score ≥ 35, unblocked, best first. */
export function getShortlist(subjectId: string): CachedMatch[] {
  // Filled on read rather than on hydrate: scoring the whole corpus for every
  // profile on every page load is what put a wait behind each header click.
  if (profileIds().length > 1 && !isScored(subjectId)) {
    recomputeMatchesFor(subjectId)
  }

  const hiddenIds = new Set(
    getDb()
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.visibility, "hidden"))
      .all()
      .map((r) => r.id),
  )

  return getDb()
    .select()
    .from(matches)
    .where(eq(matches.subjectId, subjectId))
    .all()
    .filter((r) => r.score >= MIN_SCORE && !hiddenIds.has(r.otherId))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.otherId < b.otherId ? -1 : 1))
    .map((r) => ({
      subjectId,
      otherId: r.otherId,
      score: r.score,
      factors: JSON.parse(r.factors),
      blockers: JSON.parse(r.blockers),
      computedAt: r.computedAt,
    }))
}

function allMatchRows() {
  return getDb().select().from(matches).all()
}

/**
 * Every cached pairing, blocked ones included — admin metrics input.
 *
 * Rebuilds only when a profile is missing from the table altogether. The
 * earlier guard compared row count against the full n×(n−1) matrix, which
 * rescored the entire corpus on every admin load and was most of why the
 * report read as an outage.
 */
export function getAllCachedMatches(): CachedMatch[] {
  let rows = allMatchRows()
  const ids = profileIds()

  if (ids.length > 1) {
    const scored = new Set<string>()
    for (const row of rows) {
      scored.add(row.subjectId)
      scored.add(row.otherId)
    }
    if (ids.some((id) => !scored.has(id))) {
      recomputeAllMatches()
      rows = allMatchRows()
    }
  }

  return rows.map((r) => ({
    subjectId: r.subjectId,
    otherId: r.otherId,
    score: r.score,
    factors: JSON.parse(r.factors),
    blockers: JSON.parse(r.blockers),
    computedAt: r.computedAt,
  }))
}
