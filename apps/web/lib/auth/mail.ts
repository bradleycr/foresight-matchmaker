/**
 * Outbound mail. Magic links and introduction forwards share one transport.
 *
 * Three modes, never mixed in one response for auth:
 *
 * 1. SMTP configured     → email the link; API never returns it.
 * 2. Reveal allowed      → on-screen link for demos (dev, or AUTH_REVEAL_LINKS=true).
 * 3. Neither             → log the link server-side only; API returns the same
 *                          opaque success as for unknown emails.
 */
import nodemailer from "nodemailer"
import type { Profile } from "@rmm/schema"

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_URL)
}

/**
 * On-screen reveal is opt-in in production (`AUTH_REVEAL_LINKS=true`).
 * In development it is the default when SMTP is unset, so `pnpm dev` stays
 * usable with zero infrastructure.
 */
export function revealLinksAllowed(): boolean {
  if (smtpConfigured()) return false
  if (process.env.AUTH_REVEAL_LINKS === "true") return true
  if (process.env.AUTH_REVEAL_LINKS === "false") return false
  return process.env.NODE_ENV !== "production"
}

export type DeliveryMode = "email" | "on_screen" | "server_log"

export function magicLinkMode(): DeliveryMode {
  if (smtpConfigured()) return "email"
  if (revealLinksAllowed()) return "on_screen"
  return "server_log"
}

export type MailResult = { sent: true } | { sent: false; reason: "no_smtp" | "smtp_error" }

function fromAddress(): string {
  return process.env.SMTP_FROM ?? "matchmaker@localhost"
}

export async function sendMail(opts: {
  to: string | string[]
  cc?: string | string[]
  replyTo?: string
  subject: string
  text: string
}): Promise<MailResult> {
  if (!smtpConfigured()) {
    console.info("[mail] SMTP unset; would send:", {
      to: opts.to,
      cc: opts.cc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
    })
    return { sent: false, reason: "no_smtp" }
  }

  try {
    const transport = nodemailer.createTransport(process.env.SMTP_URL)
    await transport.sendMail({
      from: fromAddress(),
      to: opts.to,
      cc: opts.cc,
      replyTo: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
    })
    return { sent: true }
  } catch (error) {
    console.error("[mail] SMTP send failed:", error)
    return { sent: false, reason: "smtp_error" }
  }
}

export async function sendMagicLink(email: string, link: string): Promise<MailResult> {
  if (!smtpConfigured()) {
    console.info(`[auth] magic link for ${email}: ${link}`)
    return { sent: false, reason: "no_smtp" }
  }

  const result = await sendMail({
    to: email,
    subject: "Your sign-in link — Foresight Matchmaking",
    text: [
      "Use this link to access your profile:",
      "",
      link,
      "",
      "The link works once and expires in 24 hours.",
      "If you did not request it, ignore this email.",
    ].join("\n"),
  })

  if (!result.sent) {
    console.info(`[auth] magic link for ${email} (smtp failed): ${link}`)
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

  return sendMail({
    to: to.contact_email,
    cc: from.contact_email,
    replyTo: from.contact_email,
    subject,
    text: [
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
      .join("\n"),
  })
}
