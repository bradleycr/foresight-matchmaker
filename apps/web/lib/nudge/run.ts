import { challengeById, type ChallengeId } from "@/lib/challenges/catalog"
import { sendMail, mailConfigured, type MailResult } from "@/lib/auth/mail"
import { renderProgrammeNudgeEmail } from "@/lib/auth/mail-templates"
import { collectSignupRows, type SignupRow } from "@/lib/db/signups"
import { durableEnabled } from "@/lib/db/durable-store"
import { hydrateListings } from "@/lib/db/durable"
import {
  NUDGE_DRIP,
  NUDGE_MAX_PER_RUN,
  emptyNudgeSkipped,
  selectNudgeCandidates,
  type NudgeCandidate,
  type NudgeSkipReason,
} from "./policy"
import { loadOptOuts, loadSentKeys, recordNudgeSent } from "./store"
import { loadNudgeOverrides, resolvedAutoNudge } from "./settings"
import { stopRemindersUrl } from "./token"

export type ListingNudgeRun = {
  ok: true
  considered: number
  eligible: number
  sent: number
  failed: number
  skipped: Record<NudgeSkipReason, number>
  stopped: "quota" | "unconfigured" | null
}

export type ListingNudgeDeps = {
  now?: Date
  rows?: SignupRow[]
  alreadySent?: Set<string>
  optedOut?: Set<string>
  autoNudge?: (id: ChallengeId) => boolean
  requireAge?: boolean
  requireAutoNudge?: boolean
  includeReminded?: boolean
  emails?: ReadonlySet<string>
  challengeId?: ChallengeId
  max?: number
  send?: (opts: {
    to: string
    subject: string
    text: string
    html?: string
    idempotencyKey?: string
    headers?: Record<string, string>
  }) => Promise<MailResult>
  recordSent?: typeof recordNudgeSent
}

function unconfigured(reason: "quota" | "unconfigured"): ListingNudgeRun {
  return {
    ok: true,
    considered: 0,
    eligible: 0,
    sent: 0,
    failed: 0,
    skipped: emptyNudgeSkipped(),
    stopped: reason,
  }
}

function idempotencyKey(candidate: NudgeCandidate, includeReminded: boolean): string {
  const drip = includeReminded ? "manual" : NUDGE_DRIP
  return `listing-nudge/${candidate.challengeId}/${candidate.email}/${drip}`
}

/**
 * Unfinished-listing reminders. The daily cron waits a week and honours
 * the programme switch. An operator send from /admin skips both so a
 * selected row or an unpublished batch can go out now.
 */
export async function runListingNudges(deps: ListingNudgeDeps = {}): Promise<ListingNudgeRun> {
  if (!mailConfigured() && !deps.send) return unconfigured("unconfigured")
  if (!durableEnabled() && deps.rows === undefined) return unconfigured("unconfigured")

  if (deps.rows === undefined) await hydrateListings()

  const now = deps.now ?? new Date()
  const rows = deps.rows ?? (await collectSignupRows())
  const alreadySent = deps.alreadySent ?? (await loadSentKeys())
  const optedOut = deps.optedOut ?? (await loadOptOuts())
  const send = deps.send ?? sendMail
  const recordSent = deps.recordSent ?? recordNudgeSent
  const includeReminded = deps.includeReminded === true
  const max = deps.max ?? NUDGE_MAX_PER_RUN

  let autoNudge = deps.autoNudge
  if (!autoNudge) {
    const overrides = await loadNudgeOverrides()
    autoNudge = (id) => resolvedAutoNudge(id, overrides)
  }

  const { candidates, skipped } = selectNudgeCandidates(rows, {
    now,
    alreadySent,
    optedOut,
    autoNudge,
    requireAge: deps.requireAge,
    requireAutoNudge: deps.requireAutoNudge,
    includeReminded,
    emails: deps.emails,
    challengeId: deps.challengeId,
  })
  const batch = candidates.slice(0, max)
  let sent = 0
  let failed = 0
  let stopped: ListingNudgeRun["stopped"] = null

  for (const candidate of batch) {
    const challenge = challengeById(candidate.challengeId)
    const stopUrl = stopRemindersUrl(candidate.email)
    const mail = renderProgrammeNudgeEmail(challenge, candidate.kind, stopUrl)
    const result = await send({
      to: candidate.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      idempotencyKey: idempotencyKey(candidate, includeReminded),
      headers: {
        "List-Unsubscribe": `<${stopUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
    if (result.sent) {
      sent += 1
      try {
        await recordSent({
          email: candidate.email,
          challenge_id: candidate.challengeId,
          kind: candidate.kind,
          drip: NUDGE_DRIP,
          sent_at: now.toISOString(),
        })
      } catch (error) {
        console.error("[nudge] record sent failed", error)
      }
      continue
    }
    if (result.reason === "quota") {
      stopped = "quota"
      break
    }
    failed += 1
  }

  return {
    ok: true,
    considered: rows.length,
    eligible: candidates.length,
    sent,
    failed,
    skipped,
    stopped,
  }
}
