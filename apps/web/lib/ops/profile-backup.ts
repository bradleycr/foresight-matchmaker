import type { Profile } from "@rmm/schema"
import { sendMail } from "@/lib/auth/mail"

/**
 * Durable, off-app copy of every published profile.
 *
 * The application database is the only live record of a submission, and on an
 * ephemeral host it can disappear between one request and the next. Mailing
 * the whole profile to the operator changes the worst case from "your work is
 * gone" to "we can ask you to confirm what we already hold": every address and
 * every answer stays recoverable from an ordinary inbox.
 */

const FALLBACK_ADDRESS = "bradley@foresight.org"

/** Where operator copies go. Falls back to the privacy contact. */
export function opsNotifyAddress(): string {
  return (
    process.env.OPS_NOTIFY_EMAIL?.trim() ||
    process.env.PRIVACY_CONTACT_EMAIL?.trim() ||
    FALLBACK_ADDRESS
  )
}

/**
 * A stalled mail provider must never hold up a submission, so the send is
 * raced against a deadline. Losing the copy is bad; losing the profile the
 * person just typed in would be worse.
 */
const SEND_DEADLINE_MS = 5000

function summarise(profile: Profile, event: ProfileBackupEvent): string {
  return [
    `Profile ${event} on Foresight Matchmaking.`,
    "",
    `Organisation: ${profile.org_name}`,
    `Contact:      ${profile.contact_email}`,
    profile.contact_name ? `Name:         ${profile.contact_name}` : "",
    profile.contact_role ? `Role:         ${profile.contact_role}` : "",
    `Type:         ${profile.kind}`,
    `Country:      ${profile.country}`,
    `Programme:    ${profile.challenge_id ?? "recoding_medicine"}`,
    `Completeness: ${profile.completeness}%`,
    `Profile id:   ${profile.id}`,
    "",
    "Keep this message. It is enough to restore or re-enter the profile if the",
    "live database is ever lost.",
    "",
    "--- Full record (JSON) ---",
    JSON.stringify(profile, null, 2),
  ]
    .filter((line) => line !== "")
    .join("\n")
}

export type ProfileBackupEvent = "created" | "updated"

export async function backupProfileByEmail(
  profile: Profile,
  event: ProfileBackupEvent,
): Promise<void> {
  const subject = `[Matchmaker ${event}] ${profile.org_name} · ${profile.contact_email}`

  try {
    const result = await Promise.race([
      sendMail({ to: opsNotifyAddress(), subject, text: summarise(profile, event) }),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), SEND_DEADLINE_MS)),
    ])

    if (result === "timeout") {
      console.error("[backup] profile copy timed out", { id: profile.id, email: profile.contact_email })
      return
    }
    if (!result.sent) {
      console.error("[backup] profile copy not sent", {
        id: profile.id,
        email: profile.contact_email,
        reason: result.reason,
      })
    }
  } catch (error) {
    console.error("[backup] profile copy failed", { id: profile.id }, error)
  }
}
