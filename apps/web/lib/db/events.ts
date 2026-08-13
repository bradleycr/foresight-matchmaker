import { eq } from "drizzle-orm"
import { getDb } from "./client"
import { events } from "./schema"

/**
 * Append-only event log. Every intro state transition, profile write, and
 * funnel-relevant page view lands here. Rows are never deleted in the
 * ordinary course — the admin funnel reads forward. GDPR erasure is the
 * one exception: see `anonymiseEventsFor`.
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

export function logEvent(type: EventType, actorId: string | null, payload: Record<string, unknown>): void {
  getDb()
    .insert(events)
    .values({
      type,
      actorId,
      payload: JSON.stringify(payload),
      createdAt: new Date().toISOString(),
    })
    .run()
}

/**
 * Strip personal linkage from every event attributed to a profile about to
 * be erased. Actor id is cleared; payloads collapse to a marker so funnel
 * counts still work without retaining identifiers.
 */
export function anonymiseEventsFor(profileId: string): void {
  getDb()
    .update(events)
    .set({ actorId: null, payload: JSON.stringify({ anonymised: true }) })
    .where(eq(events.actorId, profileId))
    .run()
}

export interface EventRow {
  id: number
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
      type: r.type,
      actorId: r.actorId,
      payload: JSON.parse(r.payload) as Record<string, unknown>,
      createdAt: r.createdAt,
    }))
}
