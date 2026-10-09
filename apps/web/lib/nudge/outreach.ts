import type { SignupRow } from "@/lib/db/signups"
import { nudgeDedupeKey, signupChallengeId } from "./policy"

/**
 * Split the register by whether this desk (or the Recoding Medicine blast)
 * has already mailed them a listing reminder.
 */
export interface OutreachBuckets {
  remindedUnfinished: SignupRow[]
  notRemindedUnfinished: SignupRow[]
  remindedListed: number
  optedOutUnfinished: number
}

export function summarizeOutreach(
  rows: readonly SignupRow[],
  sentKeys: ReadonlySet<string>,
  optedOut: ReadonlySet<string> = new Set(),
): OutreachBuckets {
  const remindedUnfinished: SignupRow[] = []
  const notRemindedUnfinished: SignupRow[] = []
  let remindedListed = 0
  let optedOutUnfinished = 0

  for (const row of rows) {
    const email = row.contact_email.trim().toLowerCase()
    const reminded = sentKeys.has(nudgeDedupeKey(signupChallengeId(row), email))
    if (row.status === "listed") {
      if (reminded) remindedListed += 1
      continue
    }
    if (optedOut.has(email)) {
      optedOutUnfinished += 1
      continue
    }
    if (reminded) remindedUnfinished.push(row)
    else notRemindedUnfinished.push(row)
  }

  remindedUnfinished.sort(
    (a, b) => b.last_seen_at.localeCompare(a.last_seen_at) || a.contact_email.localeCompare(b.contact_email),
  )
  notRemindedUnfinished.sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.contact_email.localeCompare(b.contact_email),
  )

  return { remindedUnfinished, notRemindedUnfinished, remindedListed, optedOutUnfinished }
}
