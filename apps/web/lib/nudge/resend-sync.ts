import { DEFAULT_CHALLENGE_ID } from "@/lib/challenges/catalog"
import { durableEnabled, getDurableStore } from "@/lib/db/durable-store"
import { NUDGE_DRIP } from "./policy"
import { loadSentKeys, recordNudgeSent } from "./store"

/**
 * The Recoding Medicine operator blast went through Resend, not the
 * durable send log. Pull matching inbox subjects in once so /admin can
 * tell reached-out from not-yet without listing every Resend page on
 * every visit.
 *
 * Resend lists newest first. Persist the page cursor so a later visit
 * walks further back instead of restarting at today's magic links.
 */

const MARKER = "matchmaker/nudge-settings/resend-nudge-sync.json"
export const RESEND_NUDGE_SUBJECT = "Recoding Medicine applications close 16 October"
/** Older than the 5–6 October blast — once we pass this, stop walking. */
export const RESEND_NUDGE_FLOOR = "2026-10-05T00:00:00.000Z"
const PAGES_DEFAULT = 8

export type ResendSyncMarker = {
  complete: boolean
  imported: number
  last_created_at: string | null
  after: string | null
}

type ResendRow = { id: string; to?: string[]; subject?: string; created_at?: string }

export function parseResendSyncMarker(raw: unknown): ResendSyncMarker {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    complete: record.complete === true,
    imported: typeof record.imported === "number" ? record.imported : 0,
    last_created_at: typeof record.last_created_at === "string" ? record.last_created_at : null,
    after: typeof record.after === "string" ? record.after : null,
  }
}

/** Newest-first page: last row is the oldest. Past the floor means the blast is behind us. */
export function resendSyncShouldStop(rows: readonly ResendRow[], hasMore: boolean): boolean {
  if (rows.length === 0 || !hasMore) return true
  const oldest = rows[rows.length - 1]?.created_at
  return Boolean(oldest && oldest < RESEND_NUDGE_FLOOR)
}

export async function syncResendListingNudges(opts?: { maxPages?: number }): Promise<ResendSyncMarker> {
  const empty: ResendSyncMarker = { complete: false, imported: 0, last_created_at: null, after: null }
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key || !durableEnabled()) return empty

  const store = getDurableStore()
  let marker = parseResendSyncMarker(await store.getJson(MARKER).catch(() => null))
  if (marker.complete) return marker

  const already = await loadSentKeys()
  let after = marker.after ?? undefined
  let imported = marker.imported
  let lastCreated = marker.last_created_at
  const maxPages = opts?.maxPages ?? PAGES_DEFAULT

  try {
    for (let pages = 0; pages < maxPages; pages++) {
      const qs = new URLSearchParams({ limit: "100" })
      if (after) qs.set("after", after)
      const res = await fetch(`https://api.resend.com/emails?${qs}`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) {
        console.error("[nudge] Resend list failed", res.status)
        break
      }
      const data = (await res.json()) as { has_more?: boolean; data?: ResendRow[] }
      const rows = data.data ?? []
      if (rows.length === 0) {
        marker = { complete: true, imported, last_created_at: lastCreated, after: after ?? null }
        break
      }
      for (const row of rows) {
        if (!row.subject?.includes(RESEND_NUDGE_SUBJECT)) continue
        const sentAt = row.created_at ?? new Date().toISOString()
        if (!lastCreated || sentAt > lastCreated) lastCreated = sentAt
        for (const raw of row.to ?? []) {
          const email = raw.trim().toLowerCase()
          if (!email.includes("@")) continue
          const dedupe = `${DEFAULT_CHALLENGE_ID}:${email}`
          if (already.has(dedupe)) continue
          await recordNudgeSent({
            email,
            challenge_id: DEFAULT_CHALLENGE_ID,
            kind: "unpublished",
            drip: NUDGE_DRIP,
            sent_at: sentAt,
          })
          already.add(dedupe)
          imported += 1
        }
      }
      after = rows[rows.length - 1]?.id
      const done = resendSyncShouldStop(rows, data.has_more === true)
      marker = { complete: done, imported, last_created_at: lastCreated, after: after ?? null }
      if (done) break
    }
  } catch (error) {
    console.error("[nudge] Resend reminder sync failed", error)
  }

  try {
    await store.putJson(MARKER, JSON.stringify(marker))
  } catch (error) {
    console.error("[nudge] Resend reminder sync marker failed", error)
  }
  return marker
}
