import { durableEnabled, getDurableStore } from "@/lib/db/durable-store"

/**
 * Programme / announcement mail preference. Broader than listing-reminder
 * opt-outs: once set, thank-you blasts and future programme announcements
 * skip this mailbox. Sign-in magic links still go out (transactional).
 */

const OPTOUT_PREFIX = "matchmaker/mail-optouts/"

export interface MailOptOutRecord {
  email: string
  stopped_at: string
  /** How they opted out — inbox link, /me toggle, or admin. */
  source: "unsubscribe_link" | "profile" | "admin"
}

function optOutPath(email: string): string {
  return `${OPTOUT_PREFIX}${encodeURIComponent(email.trim().toLowerCase())}.json`
}

export async function loadMailOptOuts(): Promise<Set<string>> {
  const emails = new Set<string>()
  if (!durableEnabled()) return emails
  try {
    const records = await getDurableStore().listRecords(OPTOUT_PREFIX)
    for (const record of records) {
      const value = record.value as { email?: unknown }
      if (typeof value.email === "string") emails.add(value.email.toLowerCase())
    }
  } catch (error) {
    console.error("[mail] list opt-outs failed", error)
  }
  return emails
}

export async function isMailOptedOut(email: string): Promise<boolean> {
  if (!durableEnabled()) return false
  const mailbox = email.trim().toLowerCase()
  if (!mailbox) return false
  try {
    const raw = await getDurableStore().getJson(optOutPath(mailbox))
    if (!raw || typeof raw !== "object") return false
    return typeof (raw as { email?: unknown }).email === "string"
  } catch {
    return false
  }
}

export async function recordMailOptOut(
  email: string,
  source: MailOptOutRecord["source"] = "unsubscribe_link",
): Promise<void> {
  if (!durableEnabled()) return
  const mailbox = email.trim().toLowerCase()
  const record: MailOptOutRecord = {
    email: mailbox,
    stopped_at: new Date().toISOString(),
    source,
  }
  await getDurableStore().putJson(optOutPath(mailbox), JSON.stringify(record))
}

export async function clearMailOptOut(email: string): Promise<void> {
  if (!durableEnabled()) return
  const mailbox = email.trim().toLowerCase()
  await getDurableStore().remove([optOutPath(mailbox)])
}
