/**
 * Magic-link delivery policy (2026).
 *
 * Three modes, never mixed in one response:
 *
 * 1. SMTP configured     → email the link; API never returns it.
 * 2. Reveal allowed      → on-screen link for demos (dev, or AUTH_REVEAL_LINKS=true).
 * 3. Neither             → log the link server-side only; API returns the same
 *                          opaque success as for unknown emails.
 *
 * Anti-enumeration: request-link always returns the same JSON shape. When
 * revealing on screen, unknown emails get a decoy /claim/… URL that fails
 * with the same generic error as a bad token.
 */
import nodemailer from "nodemailer"

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

export async function sendMagicLink(email: string, link: string): Promise<MailResult> {
  if (!smtpConfigured()) {
    // Always log so operators can recover a link without leaking it to the client.
    console.info(`[auth] magic link for ${email}: ${link}`)
    return { sent: false, reason: "no_smtp" }
  }

  try {
    const transport = nodemailer.createTransport(process.env.SMTP_URL)
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "matchmaker@localhost",
      to: email,
      subject: "Your sign-in link — Recoding Medicine Matchmaker",
      text: [
        "Use this link to access your profile:",
        "",
        link,
        "",
        "The link works once and expires in 24 hours.",
        "If you did not request it, ignore this email.",
      ].join("\n"),
    })
    return { sent: true }
  } catch (error) {
    console.error("[auth] SMTP send failed:", error)
    // Do NOT fall back to returning the link in the API — that reopens
    // enumeration and account-takeover via email guess. Log only.
    console.info(`[auth] magic link for ${email} (smtp failed): ${link}`)
    return { sent: false, reason: "smtp_error" }
  }
}
