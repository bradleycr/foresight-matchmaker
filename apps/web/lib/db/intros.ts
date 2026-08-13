import { eq, or, and, gt } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import type { DeclineReason, IntroState } from "@rmm/schema"
import { getDb } from "./client"
import { intros } from "./schema"
import { logEvent } from "./events"

/**
 * Introduction records. New contacts are emailed immediately (state
 * `emailed`) so the conversation continues off-platform. The table still
 * accepts legacy requested/accepted/declined/expired rows.
 *
 * Contact details are NEVER stored here — they are read from profiles when
 * serialising an emailed (or historically accepted) intro.
 *
 * Expiry is applied lazily for leftover `requested` rows. No cron.
 */

/**
 * Outbound intro requests allowed per profile per rolling 24h. Configurable
 * via env so a demo rehearsal (which sends far more than 5 requests from one
 * account in a single sitting) doesn't lock the presenter out mid-run.
 * Falls back to 5 if unset, non-numeric, or non-positive.
 */
export function rateLimitPer24h(): number {
  const raw = Number.parseInt(process.env.RATE_LIMIT_PER_24H ?? "", 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 5
}

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

/** True when an emailed (or historically accepted) intro connects the two profiles. */
export function haveAcceptedIntro(a: string, b: string): boolean {
  return listIntrosFor(a).some(
    (i) =>
      (i.state === "emailed" || i.state === "accepted") &&
      ((i.fromId === a && i.toId === b) || (i.fromId === b && i.toId === a)),
  )
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type RequestIntroResult =
  | { ok: true; intro: Intro }
  | { ok: false; error: "rate_limited" | "already_contacted" | "self_intro" }

export function requestIntro(fromId: string, toId: string, message: string): RequestIntroResult {
  if (fromId === toId) return { ok: false, error: "self_intro" }

  const db = getDb()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const recent = db
    .select({ id: intros.id })
    .from(intros)
    .where(and(eq(intros.fromId, fromId), gt(intros.createdAt, since)))
    .all()
  if (recent.length >= rateLimitPer24h()) return { ok: false, error: "rate_limited" }

  const existing = db
    .select()
    .from(intros)
    .where(
      or(
        and(eq(intros.fromId, fromId), eq(intros.toId, toId)),
        and(eq(intros.fromId, toId), eq(intros.toId, fromId)),
      ),
    )
    .all()
    .map(withLazyExpiry)
  if (existing.length > 0) return { ok: false, error: "already_contacted" }

  const now = new Date()
  const iso = now.toISOString()
  const row: typeof intros.$inferInsert = {
    id: randomUUID(),
    fromId,
    toId,
    message,
    state: "emailed",
    createdAt: iso,
    respondedAt: iso,
    expiresAt: iso,
  }
  db.insert(intros).values(row).run()
  logEvent("intro_emailed", fromId, { intro_id: row.id, to: toId })

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
