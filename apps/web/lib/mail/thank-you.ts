import { sendMail } from "@/lib/auth/mail"
import { renderThankYouRecordsEmail } from "@/lib/auth/mail-templates"
import { durableEnabled, getDurableStore } from "@/lib/db/durable-store"
import { hydrateListings } from "@/lib/db/durable"
import { listProfiles } from "@/lib/db/profiles"
import { loadMailOptOuts } from "@/lib/mail/optout-store"
import { mailUnsubscribeUrl } from "@/lib/mail/unsubscribe-token"
import { loadOptOuts as loadNudgeOptOuts } from "@/lib/nudge/store"

const SENT_PREFIX = "matchmaker/thank-you-sent/"
const BLAST_ID = "recoding_medicine_thank_you_v1"

export interface ThankYouRecipient {
  email: string
  org_name: string
}

export interface ThankYouPlan {
  blast_id: string
  eligible: number
  skipped_opt_out: number
  skipped_already_sent: number
  skipped_demo: number
  /** Count only — never addresses, except when `includeSample` is set for tests. */
  sample?: string[]
}

function sentPath(email: string): string {
  return `${SENT_PREFIX}${BLAST_ID}/${encodeURIComponent(email.trim().toLowerCase())}.json`
}

export async function loadThankYouSent(): Promise<Set<string>> {
  const emails = new Set<string>()
  if (!durableEnabled()) return emails
  try {
    const records = await getDurableStore().listRecords(`${SENT_PREFIX}${BLAST_ID}/`)
    for (const record of records) {
      const value = record.value as { email?: unknown }
      if (typeof value.email === "string") emails.add(value.email.toLowerCase())
    }
  } catch (error) {
    console.error("[thank-you] list sent failed", error)
  }
  return emails
}

async function recordThankYouSent(email: string): Promise<void> {
  if (!durableEnabled()) return
  const mailbox = email.trim().toLowerCase()
  await getDurableStore().putJson(
    sentPath(mailbox),
    JSON.stringify({ email: mailbox, blast_id: BLAST_ID, sent_at: new Date().toISOString() }),
  )
}

function looksLikeRecipient(email: string): boolean {
  const e = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false
  if (e.endsWith(".invalid") || e.endsWith("@resend.dev") || e.includes("asb-demo")) return false
  return true
}

/**
 * Listed Recoding Medicine people who have not opted out and have not
 * already received this thank-you blast.
 */
export async function planThankYouBlast(opts?: {
  includeSample?: boolean
}): Promise<{ plan: ThankYouPlan; recipients: ThankYouRecipient[] }> {
  await hydrateListings()
  const [mailOptOuts, nudgeOptOuts, already] = await Promise.all([
    loadMailOptOuts(),
    loadNudgeOptOuts(),
    loadThankYouSent(),
  ])

  const recipients: ThankYouRecipient[] = []
  let skipped_opt_out = 0
  let skipped_already_sent = 0
  let skipped_demo = 0

  for (const profile of listProfiles()) {
    if (profile.challenge_id && profile.challenge_id !== "recoding_medicine") continue
    const email = profile.contact_email.trim().toLowerCase()
    if (!looksLikeRecipient(email)) {
      skipped_demo += 1
      continue
    }
    if (mailOptOuts.has(email) || nudgeOptOuts.has(email)) {
      skipped_opt_out += 1
      continue
    }
    if (already.has(email)) {
      skipped_already_sent += 1
      continue
    }
    recipients.push({ email, org_name: profile.org_name })
  }

  recipients.sort((a, b) => a.email.localeCompare(b.email))

  const plan: ThankYouPlan = {
    blast_id: BLAST_ID,
    eligible: recipients.length,
    skipped_opt_out,
    skipped_already_sent,
    skipped_demo,
  }
  if (opts?.includeSample) {
    plan.sample = recipients.slice(0, 3).map((r) => r.email.replace(/(.{2}).+(@.+)/, "$1…$2"))
  }

  return { plan, recipients }
}

export type ThankYouSendResult = {
  attempted: number
  sent: number
  failed: number
  skipped_opt_out: number
  dry_run: boolean
  test: boolean
  stopped: string | null
}

/**
 * Send the thank-you mail. `emails` limits to an explicit set (test path).
 * Without `emails`, sends the full eligible list — only call after approval.
 */
export async function sendThankYouBlast(opts: {
  dryRun?: boolean
  emails?: string[]
  /** Cap for safety; full blast passes a high number after dry-run. */
  limit?: number
}): Promise<ThankYouSendResult & { plan: ThankYouPlan }> {
  const { plan, recipients } = await planThankYouBlast()
  const allow = opts.emails?.map((e) => e.trim().toLowerCase())
  const allowSet = allow ? new Set(allow) : null
  const queue = allowSet
    ? recipients.filter((r) => allowSet.has(r.email))
    : recipients
  // Explicit test addresses may not be in the listed cohort (e.g. forza.org).
  const extra: ThankYouRecipient[] = []
  if (allowSet) {
    for (const email of allowSet) {
      if (queue.some((r) => r.email === email)) continue
      if (!looksLikeRecipient(email)) continue
      extra.push({ email, org_name: "Test" })
    }
  }
  const targets = [...queue, ...extra].slice(0, opts.limit ?? 10_000)

  if (opts.dryRun) {
    return {
      plan,
      attempted: targets.length,
      sent: 0,
      failed: 0,
      skipped_opt_out: plan.skipped_opt_out,
      dry_run: true,
      test: Boolean(allowSet),
      stopped: null,
    }
  }

  let sent = 0
  let failed = 0
  let stopped: string | null = null

  for (const target of targets) {
    const unsub = mailUnsubscribeUrl(target.email)
    const mail = renderThankYouRecordsEmail(unsub)
    const result = await sendMail({
      to: target.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: "hello@foresightmatchmaker.app",
      idempotencyKey: `thank-you/${BLAST_ID}/${target.email}`,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
    if (result.sent) {
      sent += 1
      try {
        await recordThankYouSent(target.email)
      } catch (error) {
        console.error("[thank-you] record sent failed", error)
      }
      continue
    }
    failed += 1
    if (result.reason === "quota") {
      stopped = "quota"
      break
    }
  }

  return {
    plan,
    attempted: targets.length,
    sent,
    failed,
    skipped_opt_out: plan.skipped_opt_out,
    dry_run: false,
    test: Boolean(allowSet),
    stopped,
  }
}
