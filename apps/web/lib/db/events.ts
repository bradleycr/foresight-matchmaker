import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import { getDb } from "./client"
import { events } from "./schema"

/**
 * Append-only event log. Every intro state transition, profile write, and
 * funnel-relevant page view lands here. Rows are never deleted in the
 * ordinary course — the admin funnel reads forward. GDPR erasure is the
 * one exception: see `anonymiseEventsFor`.
 *
 * On Vercel the SQLite file is ephemeral, so each row is also written to
 * the durable store (`persistEvent`) and refilled with `hydrateEvents`.
 */

export type EventType =
  | "profile_created"
  | "profile_updated"
  | "profile_claimed"
  | "profile_deleted"
  | "shortlist_viewed"
  | "intro_requested"
  | "intro_emailed"
  | "intro_accepted"
  | "intro_declined"
  | "intro_expired"
  | "joint_application_reported"
  | "magic_link_issued"
  | "prefill_used"
  | "remmy_turn"

/** Shape dual-written to Blob so a cold start can refill SQLite. */
export interface DurableEvent {
  uid: string
  type: string
  actorId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export function logEvent(type: EventType, actorId: string | null, payload: Record<string, unknown>): DurableEvent {
  const uid = randomUUID()
  const createdAt = new Date().toISOString()
  try {
    getDb()
      .insert(events)
      .values({
        uid,
        type,
        actorId,
        payload: JSON.stringify(payload),
        createdAt,
      })
      .run()
  } catch (error) {
    console.error("[events] sqlite insert failed", { uid, type }, error)
  }

  const row: DurableEvent = { uid, type, actorId, payload, createdAt }
  void flushEvent(row)
  return row
}

/**
 * Await the Blob copy. Fire-and-forget from `logEvent` is enough on a
 * long-lived host; serverless contact-click and matches routes wait so
 * the write is not killed with the isolate.
 */
export async function flushEvent(row: DurableEvent): Promise<void> {
  try {
    const { persistEvent } = await import("./durable")
    await persistEvent(row)
  } catch (error) {
    console.error("[events] persist failed", { uid: row.uid, type: row.type }, error)
  }
}

/**
 * Adopt an event that already exists in Blob. SQLite is only the cache —
 * skip when this isolate has already seen the uid.
 */
export function cacheRemoteEvent(event: DurableEvent): void {
  if (!event.uid) return
  const db = getDb()
  const hit = db.select({ uid: events.uid }).from(events).where(eq(events.uid, event.uid)).get()
  if (hit) return
  try {
    db.insert(events)
      .values({
        uid: event.uid,
        type: event.type,
        actorId: event.actorId,
        payload: JSON.stringify(event.payload),
        createdAt: event.createdAt,
      })
      .run()
  } catch (error) {
    console.error("[events] skip duplicate uid", { uid: event.uid }, error)
  }
}

/**
 * Strip personal linkage from every event attributed to a profile about to
 * be erased. Actor id is cleared; payloads collapse to a marker so funnel
 * counts still work without retaining identifiers.
 */
export function anonymiseEventsFor(profileId: string): void {
  const rows = getDb().select().from(events).where(eq(events.actorId, profileId)).all()
  getDb()
    .update(events)
    .set({ actorId: null, payload: JSON.stringify({ anonymised: true }) })
    .where(eq(events.actorId, profileId))
    .run()

  for (const row of rows) {
    if (!row.uid) continue
    void flushEvent({
      uid: row.uid,
      type: row.type,
      actorId: null,
      payload: { anonymised: true },
      createdAt: row.createdAt,
    })
  }
}

export interface EventRow {
  id: number
  uid: string | null
  type: string
  actorId: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export function listEvents(): EventRow[] {
  return getDb()
    .select()
    .from(events)
    .all()
    .map((r) => ({
      id: r.id,
      uid: r.uid ?? null,
      type: r.type,
      actorId: r.actorId,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
      createdAt: r.createdAt,
    }))
}
