import { eq, or, and, gt } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import type { DeclineReason, IntroState } from "@rmm/schema"
import { getDb } from "./client"
import { intros } from "./schema"
import { logEvent } from "./events"

/**
 * The double opt-in intro flow.
 *
 * State machine: requested → accepted | declined | expired. Contact details
 * are NEVER stored or transmitted through this table — the reveal happens in
 * the API layer, and only for intros in `accepted` state, read fresh from the
 * profile at request time. Declining reveals nothing.
 *
 * Expiry is applied lazily: any read that touches a `requested` intro past
 * its `expires_at` transitions it first. No cron needed at this scale.
 */

const EXPIRY_DAYS = 14
const RATE_LIMIT_PER_24H = 5

export interface Intro {
  id: string
  fromId: string
  toId: string
  message: string
  state: IntroState
  declineReason: DeclineReason | null
  createdAt: string
  respondedAt: string | null
  expiresAt: string
}

type IntroRow = typeof intros.$inferSelect

function rowToIntro(row: IntroRow): Intro {
  return {
    id: row.id,
    fromId: row.fromId,
    toId: row.toId,
    message: row.message,
    state: row.state as IntroState,
    declineReason: (row.declineReason as DeclineReason) ?? null,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    expiresAt: row.expiresAt,
  }
}

/** Transition overdue `requested` intros to `expired`, then return the row. */
function withLazyExpiry(row: IntroRow): IntroRow {
  if (row.state === "requested" && row.expiresAt < new Date().toISOString()) {
    getDb().update(intros).set({ state: "expired" }).where(eq(intros.id, row.id)).run()
    logEvent("intro_expired", null, { intro_id: row.id })
    return { ...row, state: "expired" }
  }
  return row
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getIntro(id: string): Intro | null {
  const row = getDb().select().from(intros).where(eq(intros.id, id)).get()
  return row ? rowToIntro(withLazyExpiry(row)) : null
}

/** Everything sent or received by one profile — powers /me/inbox. */
export function listIntrosFor(profileId: string): Intro[] {
  return getDb()
    .select()
    .from(intros)
    .where(or(eq(intros.fromId, profileId), eq(intros.toId, profileId)))
    .all()
    .map(withLazyExpiry)
    .map(rowToIntro)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export function listAllIntros(): Intro[] {
  return getDb().select().from(intros).all().map(withLazyExpiry).map(rowToIntro)
}

/** True when an accepted intro connects the two profiles (either direction). */
export function haveAcceptedIntro(a: string, b: string): boolean {
  return listIntrosFor(a).some(
    (i) => i.state === "accepted" && ((i.fromId === a && i.toId === b) || (i.fromId === b && i.toId === a)),
  )
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type RequestIntroResult =
  | { ok: true; intro: Intro }
  | { ok: false; error: "rate_limited" | "duplicate_pending" | "self_intro" }

export function requestIntro(fromId: string, toId: string, message: string): RequestIntroResult {
  if (fromId === toId) return { ok: false, error: "self_intro" }

  const db = getDb()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Max 5 outbound requests per profile per rolling 24h.
  const recent = db
    .select({ id: intros.id })
    .from(intros)
    .where(and(eq(intros.fromId, fromId), gt(intros.createdAt, since)))
    .all()
  if (recent.length >= RATE_LIMIT_PER_24H) return { ok: false, error: "rate_limited" }

  // One open request per pair at a time.
  const pending = db
    .select()
    .from(intros)
    .where(
      and(
        or(
          and(eq(intros.fromId, fromId), eq(intros.toId, toId)),
          and(eq(intros.fromId, toId), eq(intros.toId, fromId)),
        ),
      ),
    )
    .all()
    .map(withLazyExpiry)
  if (pending.some((r) => r.state === "requested" || r.state === "accepted")) {
    return { ok: false, error: "duplicate_pending" }
  }

  const now = new Date()
  const row: typeof intros.$inferInsert = {
    id: randomUUID(),
    fromId,
    toId,
    message,
    state: "requested",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  }
  db.insert(intros).values(row).run()
  logEvent("intro_requested", fromId, { intro_id: row.id, to: toId })

  return { ok: true, intro: rowToIntro(row as IntroRow) }
}

export type RespondResult = { ok: true; intro: Intro } | { ok: false; error: "not_pending" }

export function respondToIntro(
  id: string,
  action: "accepted" | "declined",
  declineReason?: DeclineReason,
): RespondResult {
  const current = getIntro(id)
  if (!current || current.state !== "requested") return { ok: false, error: "not_pending" }

  const respondedAt = new Date().toISOString()
  getDb()
    .update(intros)
    .set({ state: action, respondedAt, declineReason: action === "declined" ? (declineReason ?? "other") : null })
    .where(eq(intros.id, id))
    .run()

  logEvent(action === "accepted" ? "intro_accepted" : "intro_declined", current.toId, {
    intro_id: id,
    ...(action === "declined" ? { reason: declineReason ?? "other" } : {}),
  })

  return { ok: true, intro: { ...current, state: action, respondedAt } }
}
