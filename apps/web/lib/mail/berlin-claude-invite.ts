import { sendMail } from "@/lib/auth/mail"
import { renderBerlinClaudeInviteEmail } from "@/lib/auth/mail-templates"
import { durableEnabled, getDurableStore } from "@/lib/db/durable-store"
import { hydrateListings } from "@/lib/db/durable"
import { listProfiles } from "@/lib/db/profiles"
import { loadMailOptOuts } from "@/lib/mail/optout-store"
import { mailUnsubscribeUrl } from "@/lib/mail/unsubscribe-token"
import { loadOptOuts as loadNudgeOptOuts } from "@/lib/nudge/store"

/**
 * Thank-you + Claude Community invite for Recoding Medicine people who
 * marked the Berlin matchmaking session (`event_sept_1`).
 */

const SENT_PREFIX = "matchmaker/thank-you-sent/"
export const BERLIN_CLAUDE_BLAST_ID = "recoding_medicine_berlin_claude_v1"

/** Berlin in-person Recoding Medicine session chip. */
export const BERLIN_ATTENDING = "event_sept_1" as const

export interface BerlinInviteRecipient {
  email: string
  org_name: string
}

export interface BerlinInvitePlan {
  blast_id: string
  eligible: number
  skipped_opt_out: number
  skipped_already_sent: number
  skipped_demo: number
  skipped_not_berlin: number
  skipped_sprind: number
  sample?: string[]
}

function sentPath(email: string): string {
  return `${SENT_PREFIX}${BERLIN_CLAUDE_BLAST_ID}/${encodeURIComponent(email.trim().toLowerCase())}.json`
}

export async function loadBerlinClaudeSent(): Promise<Set<string>> {
  const emails = new Set<string>()
  if (!durableEnabled()) return emails
  try {
    const records = await getDurableStore().listRecords(`${SENT_PREFIX}${BERLIN_CLAUDE_BLAST_ID}/`)
    for (const record of records) {
      const value = record.value as { email?: unknown }
      if (typeof value.email === "string") emails.add(value.email.toLowerCase())
    }
  } catch (error) {
    console.error("[berlin-claude] list sent failed", error)
  }
  return emails
}

async function recordBerlinClaudeSent(email: string): Promise<void> {
  if (!durableEnabled()) return
  const mailbox = email.trim().toLowerCase()
  await getDurableStore().putJson(
    sentPath(mailbox),
    JSON.stringify({
      email: mailbox,
      blast_id: BERLIN_CLAUDE_BLAST_ID,
      sent_at: new Date().toISOString(),
    }),
  )
}

function looksLikeRecipient(email: string): boolean {
  const e = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false
  if (e.endsWith(".invalid") || e.endsWith("@resend.dev") || e.includes("asb-demo")) return false
  return true
}

/** Challenge host team — never include in partner-facing blasts. */
export function isSprindTeam(email: string, orgName?: string): boolean {
  const e = email.trim().toLowerCase()
  if (e.endsWith("@sprind.org") || e.endsWith("@sprind.de")) return true
  if (orgName && /\bsprind\b/i.test(orgName)) return true
  return false
}

/** Recoding Medicine + Berlin attending, minus opt-outs and already-sent. */
export async function planBerlinClaudeInvite(opts?: {
  includeSample?: boolean
}): Promise<{ plan: BerlinInvitePlan; recipients: BerlinInviteRecipient[] }> {
  await hydrateListings()
  const [mailOptOuts, nudgeOptOuts, already] = await Promise.all([
    loadMailOptOuts(),
    loadNudgeOptOuts(),
    loadBerlinClaudeSent(),
  ])

  const recipients: BerlinInviteRecipient[] = []
  let skipped_opt_out = 0
  let skipped_already_sent = 0
  let skipped_demo = 0
  let skipped_not_berlin = 0
  let skipped_sprind = 0

  for (const profile of listProfiles()) {
    if (profile.challenge_id && profile.challenge_id !== "recoding_medicine") continue
    if (!profile.attending.includes(BERLIN_ATTENDING)) {
      skipped_not_berlin += 1
      continue
    }
    const email = profile.contact_email.trim().toLowerCase()
    if (!looksLikeRecipient(email)) {
      skipped_demo += 1
      continue
    }
    if (isSprindTeam(email, profile.org_name)) {
      skipped_sprind += 1
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

  const plan: BerlinInvitePlan = {
    blast_id: BERLIN_CLAUDE_BLAST_ID,
    eligible: recipients.length,
    skipped_opt_out,
    skipped_already_sent,
    skipped_demo,
    skipped_not_berlin,
    skipped_sprind,
  }
  if (opts?.includeSample) {
    plan.sample = recipients.slice(0, 3).map((r) => r.email.replace(/(.{2}).+(@.+)/, "$1…$2"))
  }

  return { plan, recipients }
}

export type BerlinInviteSendResult = {
  attempted: number
  sent: number
  failed: number
  skipped_opt_out: number
  dry_run: boolean
  test: boolean
  stopped: string | null
}

/**
 * Send the Berlin Claude invite. `emails` limits to an explicit set (test).
 * Without `emails`, sends the full eligible Berlin cohort — only after approval.
 */
export async function sendBerlinClaudeInvite(opts: {
  dryRun?: boolean
  emails?: string[]
  limit?: number
}): Promise<BerlinInviteSendResult & { plan: BerlinInvitePlan }> {
  const { plan, recipients } = await planBerlinClaudeInvite()
  const allow = opts.emails?.map((e) => e.trim().toLowerCase())
  const allowSet = allow ? new Set(allow) : null
  const queue = allowSet ? recipients.filter((r) => allowSet.has(r.email)) : recipients
  const extra: BerlinInviteRecipient[] = []
  if (allowSet) {
    for (const email of allowSet) {
      if (queue.some((r) => r.email === email)) continue
      if (!looksLikeRecipient(email)) continue
      // Explicit test addresses (e.g. bradley@foresight.org) may bypass the
      // Berlin cohort filter, but never the SPRIND exclusion.
      if (isSprindTeam(email)) continue
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
    const mail = renderBerlinClaudeInviteEmail(unsub)
    const result = await sendMail({
      to: target.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: "hello@foresightmatchmaker.app",
      // Bump the key suffix when the template body changes so Resend will
      // deliver a fresh test instead of replaying the previous idempotent send.
      idempotencyKey: `thank-you/${BERLIN_CLAUDE_BLAST_ID}/fmt2/${target.email}`,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
    if (result.sent) {
      sent += 1
      try {
        await recordBerlinClaudeSent(target.email)
      } catch (error) {
        console.error("[berlin-claude] record sent failed", error)
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
