/**
 * Outbound mail. Magic links and introduction forwards share one transport.
 *
 * Prefer Resend’s HTTP API on Vercel (`RESEND_API_KEY`). SMTP_URL remains
 * for a VM that already has a mail relay. From address is SMTP_FROM.
 *
 * Auth delivery:
 *
 * 1. Mail configured → email the link. Do not also auto-claim it on-screen
 *    (that burns the one-time token before they open the inbox).
 * 2. Mail send failed, AUTH_REVEAL_LINKS=true → on-screen fallback.
 * 3. Neither → log the link server-side only.
 */
import nodemailer from "nodemailer"
import type { Profile } from "@rmm/schema"
import { renderAuthEmail, type AuthEmailKind } from "./mail-templates"

const RESEND_API = "https://api.resend.com/emails"
const DEFAULT_FROM = "Foresight Matchmaking <hello@foresightmatchmaker.app>"

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() || process.env.SMTP_URL?.trim())
}

/** @deprecated use mailConfigured — kept so existing call sites keep compiling. */
export function smtpConfigured(): boolean {
  return mailConfigured()
}

/**
 * On-screen reveal is opt-in in production (`AUTH_REVEAL_LINKS=true`).
 * An explicit true still wins even when mail is configured, so a first
 * Resend deploy cannot lock people out before DNS is live.
 */
export function revealLinksAllowed(): boolean {
  if (process.env.AUTH_REVEAL_LINKS === "true") return true
  if (mailConfigured()) return false
  if (process.env.AUTH_REVEAL_LINKS === "false") return false
  return process.env.NODE_ENV !== "production"
}

export type DeliveryMode = "email" | "on_screen" | "server_log"

export function magicLinkMode(): DeliveryMode {
  if (mailConfigured()) return "email"
  if (revealLinksAllowed()) return "on_screen"
  return "server_log"
}

export type MailResult = { sent: true } | { sent: false; reason: "no_smtp" | "smtp_error" }

const SEND_TIMEOUT_MS = 8_000
const RETRY_WAIT_MS = 400

function fromAddress(): string {
  return process.env.SMTP_FROM?.trim() || DEFAULT_FROM
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryableHttp(status: number): boolean {
  return status === 429 || status >= 500
}

function asList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? value : [value]
}

async function sendViaResend(opts: {
  to: string | string[]
  cc?: string | string[]
  replyTo?: string
  subject: string
  text: string
  html?: string
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: "no_smtp" }

  const payload = JSON.stringify({
    from: fromAddress(),
    to: asList(opts.to),
    cc: asList(opts.cc),
    reply_to: opts.replyTo,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  })

  // One retry on timeout / 429 / 5xx — a webinar burst of ~50 concurrent
  // sign-ins is well inside Resend's API; a single blip should not drop a seat.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "User-Agent": "foresight-matchmaker/mail",
        },
        body: payload,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      })
      if (res.ok) return { sent: true }
      const detail = await res.text().catch(() => "")
      console.error("[mail] Resend rejected:", res.status, detail.slice(0, 500))
      if (retryableHttp(res.status) && attempt < 2) {
        const retryAfter = Number(res.headers.get("retry-after"))
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 2_000) : RETRY_WAIT_MS)
        continue
      }
      return { sent: false, reason: "smtp_error" }
    } catch (error) {
      console.error("[mail] Resend send failed:", error)
      if (attempt < 2) {
        await sleep(RETRY_WAIT_MS)
        continue
      }
      return { sent: false, reason: "smtp_error" }
    }
  }

  return { sent: false, reason: "smtp_error" }
}

/** Reused across invocations on a warm function so SMTP does not handshake 50 times. */
let smtpTransport: { sendMail: (mail: object) => Promise<unknown> } | undefined

function smtpPool() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      url: process.env.SMTP_URL,
      pool: true,
      maxConnections: 8,
      maxMessages: 100,
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: 12_000,
    })
  }
  return smtpTransport
}

export async function sendMail(opts: {
  to: string | string[]
  cc?: string | string[]
  replyTo?: string
  subject: string
  text: string
  html?: string
}): Promise<MailResult> {
  if (!mailConfigured()) {
    console.info("[mail] unset; would send:", {
      to: opts.to,
      cc: opts.cc,
      replyTo: opts.replyTo,
      subject: opts.subject,
    })
    return { sent: false, reason: "no_smtp" }
  }

  if (process.env.RESEND_API_KEY) return sendViaResend(opts)

  try {
    await smtpPool().sendMail({
      from: fromAddress(),
      to: opts.to,
      cc: opts.cc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    })
    return { sent: true }
  } catch (error) {
    console.error("[mail] SMTP send failed:", error)
    return { sent: false, reason: "smtp_error" }
  }
}

export async function sendMagicLink(
  email: string,
  link: string,
  kind: AuthEmailKind = "signin",
): Promise<MailResult> {
  if (!mailConfigured()) {
    console.info(`[auth] magic link for ${email}: ${link}`)
    return { sent: false, reason: "no_smtp" }
  }

  const { subject, text, html } = renderAuthEmail(kind, link)
  const result = await sendMail({ to: email, subject, text, html })
  if (!result.sent) {
    console.info(`[auth] magic link for ${email} (send failed): ${link}`)
  }
  return result
}

/**
 * Forward an introduction off-platform. Recipient is To; sender is Cc and
 * Reply-To so the thread continues in ordinary email, not on this site.
 */
export async function sendIntroductionEmail(input: {
  from: Profile
  to: Profile
  message: string
  fromProfileUrl: string
}): Promise<MailResult> {
  const { from, to, message, fromProfileUrl } = input
  const subject = `${from.org_name} would like to connect — Foresight Matchmaking`
  const text = [
    `${from.org_name} sent you an introduction through Foresight Matchmaking.`,
    "",
    "Reply to this email to continue the conversation directly. Foresight Matchmaking will not host further messages.",
    "",
    "— Message —",
    message,
    "",
    "— From —",
    from.org_name,
    [from.contact_name, from.contact_role].filter(Boolean).join(" · "),
    from.contact_email,
    from.website ? from.website : "",
    `Profile: ${fromProfileUrl}`,
    "",
    "— To —",
    to.org_name,
    [to.contact_name, to.contact_role].filter(Boolean).join(" · "),
    to.contact_email,
  ]
    .filter((line) => line !== "")
    .join("\n")

  return sendMail({
    to: to.contact_email,
    cc: from.contact_email,
    replyTo: from.contact_email,
    subject,
    text,
  })
}
