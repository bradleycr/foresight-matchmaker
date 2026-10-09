import { publicOrigin } from "@/lib/public-origin"
import type { ChallengeDef } from "@/lib/challenges/catalog"
import en from "../../locales/en.json"

/**
 * HTML for outbound mail. Email clients ignore web fonts, so Georgia stands
 * in for Arizona and Helvetica for Unica. Colours are the same tokens as
 * the site: powder-blue paper, ink, butter-gold mark, teal.
 */

const PAPER = "#e5f0f6"
const PAPER_SHADE = "#d5e6ee"
const INK = "#17150f"
const INK_SOFT = "#3a4a4e"
const INK_FAINT = "#6a7c82"
const MARK = "#edcf5a"
const MARK_INK = "#171200"
const TEAL = "#1f7a74"
const RULE = "#b8cdd4"
const LOGO = "https://foresightmatchmaker.app/partners/foresight.png"
const SITE = "https://foresightmatchmaker.app"

export type AuthEmailKind = "signin" | "welcome"

export interface AuthEmailCopy {
  subject: string
  preheader: string
  kicker: string
  title: string
  body: string
  button: string
  expiry: string
  ignore: string
}

const COPY: Record<AuthEmailKind, AuthEmailCopy> = {
  welcome: {
    subject: "Confirm your email — Foresight Matchmaking",
    preheader: "Then fill in the profile.",
    kicker: "Foresight Matchmaking",
    title: "Confirm your email",
    body: "Confirm your email address. Then you can fill in a profile.",
    button: "Confirm email",
    expiry: "Valid for 24 hours.",
    ignore: "If you did not request this, ignore it.",
  },
  signin: {
    subject: "Sign in — Foresight Matchmaking",
    preheader: "Valid for 24 hours.",
    kicker: "Foresight Matchmaking",
    title: "Sign in",
    body: "Use this link to sign in. If you do not have a profile yet, you can add one after confirming.",
    button: "Sign in",
    expiry: "Valid for 24 hours.",
    ignore: "If you did not request this, ignore it.",
  },
}

export function authEmailCopy(kind: AuthEmailKind): AuthEmailCopy {
  return COPY[kind]
}

/** Recoding Medicine close — same string as the catalogue `deadlineLabel`. */
export const RECODING_DEADLINE = "16 October 2026, 18:00 CET"

export const PROFILE_NUDGE_CTA = `${SITE}/signin?next=${encodeURIComponent("/register")}`

export type ProfileNudgeKind = "unpublished" | "unopened"

const NUDGE: Record<
  ProfileNudgeKind,
  { title: string; body: string; button: string; ignore: string }
> = {
  unpublished: {
    title: "Finish your listing",
    body: "You signed in to Foresight Matchmaking but you have not published a profile yet. Sign in and finish the listing so partners can find you before the deadline.",
    button: "Finish your listing",
    ignore:
      "If you already published, ignore this. If you do not want another reminder, reply to this email and we will stop.",
  },
  unopened: {
    title: "Confirm your email",
    body: "You asked for a Foresight Matchmaking sign-in link but you have not opened it yet. That link expires. Request a new one, confirm your email, and publish a Recoding Medicine listing before the deadline.",
    button: "Get a new sign-in link",
    ignore:
      "If you did not ask to join, ignore this. If you do not want another reminder, reply to this email and we will stop.",
  },
}

export interface ListingNudgeCopy {
  subject: string
  preheader: string
  /** Bold first line. Omit on rolling programmes that have no close date. */
  deadlineLead?: string
  title: string
  body: string
  button: string
  ignore: string
}

export function programmeName(id: string): string {
  return (en as Record<string, string>)[`challenge.${id}.name`] ?? id
}

export function listingNudgeCta(challengeId: string): string {
  const next = `/register?challenge=${challengeId}`
  return `${publicOrigin()}/signin?next=${encodeURIComponent(next)}`
}

/**
 * Catalogue-driven reminder. Deadline programmes lead with the close date.
 * Rolling ones (AI Safety Berlin and later) skip that line.
 */
export function programmeNudgeCopy(
  challenge: ChallengeDef,
  kind: ProfileNudgeKind,
): ListingNudgeCopy {
  const name = programmeName(challenge.id)
  const deadlineLead = challenge.deadlineLabel
    ? `Reminder: ${name} applications close ${challenge.deadlineLabel}.`
    : undefined
  const closeBit = challenge.deadlineShort ?? challenge.deadlineLabel
  const subject = closeBit
    ? `Reminder: ${name} applications close ${closeBit}`
    : kind === "unopened"
      ? `Confirm your email — ${name}`
      : `Finish your ${name} listing`

  if (kind === "unopened") {
    return {
      subject,
      preheader: deadlineLead ?? "Your sign-in link expires. Request a new one.",
      deadlineLead,
      title: "Confirm your email",
      body: `You asked for a Foresight Matchmaking sign-in link for ${name} but you have not opened it yet. That link expires. Request a new one, confirm your email, and publish a listing.`,
      button: "Get a new sign-in link",
      ignore:
        "If you did not ask to join, ignore this. If you do not want another reminder, use the stop link below.",
    }
  }

  return {
    subject,
    preheader: deadlineLead ?? `Finish your ${name} listing on Foresight Matchmaking.`,
    deadlineLead,
    title: "Finish your listing",
    body: `You signed in to Foresight Matchmaking for ${name} but you have not published a listing yet. Sign in and finish it so people in the programme can find you.`,
    button: "Finish your listing",
    ignore:
      "If you already published, ignore this. If you do not want another reminder, use the stop link below.",
  }
}

/**
 * Shared chrome for listing reminders. `stopUrl` is the HMAC opt-out for
 * the automated drip; the Recoding Medicine one-shot omits it.
 */
export function renderListingNudgeEmail(
  copy: ListingNudgeCopy,
  ctaUrl: string,
  stopUrl?: string,
): { subject: string; text: string; html: string } {
  const href = escapeHtml(ctaUrl)
  const origin = publicOrigin()
  const stopHref = stopUrl ? escapeHtml(stopUrl) : ""
  const lead = copy.deadlineLead
  const titleMargin = lead ? "14px 0 0 0" : "10px 0 0 0"

  const text = [
    lead ?? copy.title,
    "",
    ...(lead ? [copy.title, ""] : []),
    copy.body,
    "",
    copy.button,
    ctaUrl,
    "",
    copy.ignore,
    ...(stopUrl ? ["", "Stop reminders:", stopUrl] : []),
    "",
    "Foresight Institute · foresight.org",
    origin,
  ].join("\n")

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div lang="en" dir="ltr" style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.preheader)}</div>
  <table lang="en" dir="ltr" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:${PAPER};border:2px solid ${INK};">
          <tr>
            <td style="height:8px;line-height:8px;background:${MARK};font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <img src="${LOGO}" alt="Foresight Institute" width="160" style="display:block;width:160px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${TEAL};">Foresight Matchmaking</p>
              ${lead ? `<p style="margin:14px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.45;color:${INK};font-weight:bold;">${escapeHtml(lead)}</p>` : ""}
              <h1 style="margin:${titleMargin};font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.1;font-weight:normal;text-transform:uppercase;letter-spacing:-0.02em;color:${INK};">${escapeHtml(copy.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(copy.body)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${MARK};">
                    <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;color:${MARK_INK};">${escapeHtml(copy.button)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_FAINT};">${escapeHtml(copy.ignore)}</p>
              <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_FAINT};word-break:break-all;">
                <a href="${href}" style="color:${TEAL};">${href}</a>
              </p>
              ${
                stopUrl
                  ? `<p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_FAINT};">
                <a href="${stopHref}" style="color:${TEAL};">Stop listing reminders</a>
              </p>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 28px 32px;border-top:1px solid ${RULE};background:${PAPER_SHADE};">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${INK_SOFT};">Foresight Institute · independently operated directory</p>
              <p style="margin:6px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;">
                <a href="${escapeHtml(origin)}" style="color:${TEAL};">${escapeHtml(origin.replace("https://", ""))}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: copy.subject, text, html }
}

export function renderProgrammeNudgeEmail(
  challenge: ChallengeDef,
  kind: ProfileNudgeKind,
  stopUrl: string,
): { subject: string; text: string; html: string } {
  return renderListingNudgeEmail(programmeNudgeCopy(challenge, kind), listingNudgeCta(challenge.id), stopUrl)
}

/**
 * One-shot Recoding Medicine reminder. Deadline is the first line — inbox
 * subject, preheader, and bold body lead. Two bodies: signed-in but never
 * listed, or asked for a magic link and never opened it.
 */
export function renderProfileNudgeEmail(
  kind: ProfileNudgeKind = "unpublished",
): { subject: string; text: string; html: string } {
  const copy = NUDGE[kind]
  const deadline = `Reminder: Recoding Medicine applications close ${RECODING_DEADLINE}.`
  return renderListingNudgeEmail(
    {
      subject: "Reminder: Recoding Medicine applications close 16 October",
      preheader: deadline,
      deadlineLead: deadline,
      title: copy.title,
      body: copy.body,
      button: copy.button,
      ignore: copy.ignore,
    },
    PROFILE_NUDGE_CTA,
  )
}

/** Published but Hidden — partners cannot see them in the directory. */
export function renderHiddenListingEmail(): { subject: string; text: string; html: string } {
  const deadline = `Reminder: Recoding Medicine applications close ${RECODING_DEADLINE}.`
  const cta = `${SITE}/signin?next=${encodeURIComponent("/me")}`
  return renderListingNudgeEmail(
    {
      subject: "Your Recoding Medicine listing is hidden",
      preheader: deadline,
      deadlineLead: deadline,
      title: "Your listing is hidden",
      body: "You published a Recoding Medicine profile, but visibility is set to Hidden. Other members cannot see you in the directory or on their shortlists. Sign in, open Visibility, and switch to Signed-in users (or Public) if you want partners to find you before the deadline.",
      button: "Change visibility",
      ignore: "If you meant to stay hidden, ignore this. If you do not want another reminder, reply to this email and we will stop.",
    },
    cta,
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function renderAuthEmail(kind: AuthEmailKind, link: string): { subject: string; text: string; html: string } {
  const copy = COPY[kind]
  const href = escapeHtml(link)
  const text = [
    copy.title,
    "",
    copy.body,
    "",
    copy.button,
    link,
    "",
    copy.expiry,
    copy.ignore,
    "",
    "Foresight Institute · foresight.org",
    SITE,
  ].join("\n")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:${PAPER};border:2px solid ${INK};">
          <tr>
            <td style="height:8px;line-height:8px;background:${MARK};font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <img src="${LOGO}" alt="Foresight Institute" width="160" style="display:block;width:160px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${TEAL};">${escapeHtml(copy.kicker)}</p>
              <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.1;font-weight:normal;text-transform:uppercase;letter-spacing:-0.02em;color:${INK};">${escapeHtml(copy.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(copy.body)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${MARK};">
                    <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;color:${MARK_INK};">${escapeHtml(copy.button)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_FAINT};">${escapeHtml(copy.expiry)}</p>
              <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_FAINT};word-break:break-all;">
                <a href="${href}" style="color:${TEAL};">${href}</a>
              </p>
              <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_FAINT};">${escapeHtml(copy.ignore)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 28px 32px;border-top:1px solid ${RULE};background:${PAPER_SHADE};">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${INK_SOFT};">Foresight Institute · independently operated directory</p>
              <p style="margin:6px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;">
                <a href="${SITE}" style="color:${TEAL};">${SITE.replace("https://", "")}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: copy.subject, text, html }
}
