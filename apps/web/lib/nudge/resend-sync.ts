import { DEFAULT_CHALLENGE_ID } from "@/lib/challenges/catalog"
import { durableEnabled, getDurableStore } from "@/lib/db/durable-store"
import { NUDGE_DRIP } from "./policy"
import { loadSentKeys, recordNudgeSent } from "./store"

/**
 * The Recoding Medicine operator blast went through Resend, not the
 * durable send log. Pull matching inbox subjects in once so /admin can
 * tell reached-out from not-yet without listing every Resend page on
 * every visit.
 */

const MARKER = "matchmaker/nudge-settings/resend-nudge-sync.json"
const SUBJECT = "Recoding Medicine applications close 16 October"

type Marker = { complete: boolean; imported: number; last_created_at: string | null }

function parseMarker(raw: unknown): Marker {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    complete: record.complete === true,
    imported: typeof record.imported === "number" ? record.imported : 0,
    last_created_at: typeof record.last_created_at === "string" ? record.last_created_at : null,
  }
}

export async function syncResendListingNudges(): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key || !durableEnabled()) return

  const store = getDurableStore()
  let marker = parseMarker(await store.getJson(MARKER).catch(() => null))
  if (marker.complete) return

  const already = await loadSentKeys()
  let after: string | undefined
  let imported = marker.imported
  let lastCreated = marker.last_created_at
  let pages = 0

  try {
    for (; pages < 8; pages++) {
      const qs = new URLSearchParams({ limit: "100" })
      if (after) qs.set("after", after)
      const res = await fetch(`https://api.resend.com/emails?${qs}`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) {
        console.error("[nudge] Resend list failed", res.status)
        break
      }
      const data = (await res.json()) as {
        has_more?: boolean
        data?: Array<{ id: string; to?: string[]; subject?: string; created_at?: string }>
      }
      const rows = data.data ?? []
      if (rows.length === 0) {
        marker = { complete: true, imported, last_created_at: lastCreated }
        break
      }
      for (const row of rows) {
        if (!row.subject?.includes(SUBJECT)) continue
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
      if (!data.has_more) {
        marker = { complete: true, imported, last_created_at: lastCreated }
        break
      }
      after = rows[rows.length - 1]?.id
      marker = { complete: false, imported, last_created_at: lastCreated }
    }
  } catch (error) {
    console.error("[nudge] Resend reminder sync failed", error)
  }

  try {
    await store.putJson(MARKER, JSON.stringify(marker))
  } catch (error) {
    console.error("[nudge] Resend reminder sync marker failed", error)
  }
}
