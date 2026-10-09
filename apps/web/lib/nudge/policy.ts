import { DEFAULT_CHALLENGE_ID, challengeIdOf, programmeAutoNudge, type ChallengeId } from "@/lib/challenges/catalog"
import type { ProfileNudgeKind } from "@/lib/auth/mail-templates"
import type { SignupRow } from "@/lib/db/signups"

/**
 * One reminder, seven days after they started, if they still have no listing.
 *
 * Best practice for this funnel: wait long enough that a busy week is not
 * nagged, send once, and never follow a programme that already had a
 * manual blast. Recoding Medicine is opted out in the catalogue by default;
 * /admin can turn it back on.
 */

export const NUDGE_DELAY_MS = 7 * 24 * 60 * 60 * 1000
export const NUDGE_MAX_PER_RUN = 25
export const NUDGE_DRIP = "week_later" as const

/** Operator inboxes that must never receive a drip. */
export const NUDGE_SKIP_EMAILS = new Set(["bradley@foresight.org"])

export type NudgeSkipReason =
  | "listed"
  | "too_young"
  | "opted_out"
  | "already_sent"
  | "programme_off"
  | "operator"
  | "invalid"

export interface NudgeCandidate {
  email: string
  challengeId: ChallengeId
  kind: ProfileNudgeKind
  createdAt: string
}

export interface NudgeSelection {
  candidates: NudgeCandidate[]
  skipped: Record<NudgeSkipReason, number>
}

export interface SelectNudgeOpts {
  now: Date
  alreadySent: ReadonlySet<string>
  optedOut: ReadonlySet<string>
  /** Defaults to the catalogue flag. */
  autoNudge?: (id: ChallengeId) => boolean
  /** Cron waits a week. Operator sends from /admin skip this. */
  requireAge?: boolean
  /** Cron honours the programme switch. Operator sends skip this. */
  requireAutoNudge?: boolean
  /** Cron never re-mails. A selected send from /admin may. */
  includeReminded?: boolean
  emails?: ReadonlySet<string>
  challengeId?: ChallengeId
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function looksLikeRecipient(email: string): boolean {
  const value = email.trim().toLowerCase()
  if (!EMAIL_RE.test(value)) return false
  if (value.endsWith(".invalid") || value.endsWith("@resend.dev")) return false
  return true
}

export function signupChallengeId(row: SignupRow): ChallengeId {
  return challengeIdOf(row.challenge_id || undefined)
}

function rowBelongsToChallenge(row: SignupRow, challengeId: string): boolean {
  if (row.challenge_id) return row.challenge_id === challengeId
  return challengeId === DEFAULT_CHALLENGE_ID
}

export function nudgeKindOf(status: SignupRow["status"]): ProfileNudgeKind | null {
  if (status === "listed") return null
  return status === "confirmed" ? "unpublished" : "unopened"
}

export function nudgeDedupeKey(challengeId: string, email: string): string {
  return `${challengeId}:${email.trim().toLowerCase()}`
}

export function emptyNudgeSkipped(): Record<NudgeSkipReason, number> {
  return {
    listed: 0,
    too_young: 0,
    opted_out: 0,
    already_sent: 0,
    programme_off: 0,
    operator: 0,
    invalid: 0,
  }
}

/**
 * Oldest unfinished first. Cap is applied by the runner after this so a
 * quota stop still leaves the rest for tomorrow.
 */
export function selectNudgeCandidates(rows: readonly SignupRow[], opts: SelectNudgeOpts): NudgeSelection {
  const skipped = emptyNudgeSkipped()
  const requireAge = opts.requireAge !== false
  const requireAutoNudge = opts.requireAutoNudge !== false
  const autoNudge = opts.autoNudge ?? programmeAutoNudge
  const cut = opts.now.getTime() - NUDGE_DELAY_MS
  const candidates: NudgeCandidate[] = []

  for (const row of rows) {
    const email = row.contact_email.trim().toLowerCase()
    if (opts.emails && !opts.emails.has(email)) continue
    if (opts.challengeId && !rowBelongsToChallenge(row, opts.challengeId)) continue

    const kind = nudgeKindOf(row.status)
    if (!kind) {
      skipped.listed += 1
      continue
    }
    if (!looksLikeRecipient(email)) {
      skipped.invalid += 1
      continue
    }
    if (NUDGE_SKIP_EMAILS.has(email)) {
      skipped.operator += 1
      continue
    }
    if (opts.optedOut.has(email)) {
      skipped.opted_out += 1
      continue
    }
    const challengeId = signupChallengeId(row)
    if (requireAutoNudge && !autoNudge(challengeId)) {
      skipped.programme_off += 1
      continue
    }
    if (!opts.includeReminded && opts.alreadySent.has(nudgeDedupeKey(challengeId, email))) {
      skipped.already_sent += 1
      continue
    }
    const started = Date.parse(row.created_at)
    if (requireAge && (!Number.isFinite(started) || started > cut)) {
      skipped.too_young += 1
      continue
    }
    candidates.push({ email, challengeId, kind, createdAt: row.created_at })
  }

  candidates.sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.email.localeCompare(b.email),
  )

  return { candidates, skipped }
}
