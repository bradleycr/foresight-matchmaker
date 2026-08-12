import { getDb } from "./client"
import { events } from "./schema"

/**
 * Append-only event log. Every intro state transition, profile write, and
 * funnel-relevant page view lands here. Rows are never updated or deleted —
 * the admin funnel and response-time metrics are derived by reading forward.
 */

export type EventType =
  | "profile_created"
  | "profile_updated"
  | "profile_claimed"
  | "shortlist_viewed"
  | "intro_requested"
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
