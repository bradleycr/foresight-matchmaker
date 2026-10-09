import { durableEnabled, getDurableStore } from "@/lib/db/durable-store"
import { NUDGE_DRIP, nudgeDedupeKey } from "./policy"

/**
 * Send log and suppression list. Keys stay in the same `matchmaker/`
 * namespace as signups so Blob recovery copies them too.
 */

const SENT_PREFIX = "matchmaker/nudges/"
const OPTOUT_PREFIX = "matchmaker/nudge-optouts/"

export interface NudgeSentRecord {
  email: string
  challenge_id: string
  kind: "unpublished" | "unopened"
  drip: typeof NUDGE_DRIP
  sent_at: string
}

export interface NudgeOptOutRecord {
  email: string
  stopped_at: string
}

function sentPath(challengeId: string, email: string): string {
  return `${SENT_PREFIX}${challengeId}/${encodeURIComponent(email.toLowerCase())}.json`
}

function optOutPath(email: string): string {
  return `${OPTOUT_PREFIX}${encodeURIComponent(email.toLowerCase())}.json`
}

export async function loadSentKeys(): Promise<Set<string>> {
  const keys = new Set<string>()
  if (!durableEnabled()) return keys
  try {
    const records = await getDurableStore().listRecords(SENT_PREFIX)
    for (const record of records) {
      const value = record.value as { email?: unknown; challenge_id?: unknown }
      if (typeof value.email !== "string" || typeof value.challenge_id !== "string") continue
      keys.add(nudgeDedupeKey(value.challenge_id, value.email))
    }
  } catch (error) {
    console.error("[nudge] list sent failed", error)
  }
  return keys
}

export async function loadOptOuts(): Promise<Set<string>> {
  const emails = new Set<string>()
  if (!durableEnabled()) return emails
  try {
    const records = await getDurableStore().listRecords(OPTOUT_PREFIX)
    for (const record of records) {
      const value = record.value as { email?: unknown }
      if (typeof value.email === "string") emails.add(value.email.toLowerCase())
    }
  } catch (error) {
    console.error("[nudge] list opt-outs failed", error)
  }
  return emails
}

export async function recordNudgeSent(record: NudgeSentRecord): Promise<void> {
  if (!durableEnabled()) return
  await getDurableStore().putJson(sentPath(record.challenge_id, record.email), JSON.stringify(record))
}

export async function recordNudgeOptOut(email: string): Promise<void> {
  if (!durableEnabled()) return
  const mailbox = email.trim().toLowerCase()
  const record: NudgeOptOutRecord = { email: mailbox, stopped_at: new Date().toISOString() }
  await getDurableStore().putJson(optOutPath(mailbox), JSON.stringify(record))
}
