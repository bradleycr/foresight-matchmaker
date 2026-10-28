/**
 * One-shot: send the Berlin Claude invite demo to a single mailbox.
 *
 *   set -a && source /tmp/fm-mail.env && set +a
 *   cd apps/web && pnpm exec tsx scripts/send-berlin-claude-demo.ts bradley@foresight.org
 */
import { sendMail, mailConfigured } from "@/lib/auth/mail"
import { renderBerlinClaudeInviteEmail } from "@/lib/auth/mail-templates"
import { mailUnsubscribeUrl } from "@/lib/mail/unsubscribe-token"

async function main() {
  const to = (process.argv[2] ?? "").trim().toLowerCase()
  if (!to.includes("@")) {
    console.error("Usage: tsx scripts/send-berlin-claude-demo.ts you@example.org")
    process.exit(1)
  }
  // Local `vercel env pull` may write the literal "[SENSITIVE]" for hidden
  // vars — never let that poison public links or the From header.
  if (!process.env.APP_URL || process.env.APP_URL.includes("SENSITIVE")) {
    process.env.APP_URL = "https://foresightmatchmaker.app"
  }
  if (!process.env.SMTP_FROM || process.env.SMTP_FROM.includes("SENSITIVE")) {
    process.env.SMTP_FROM = "Foresight Matchmaking <hello@foresightmatchmaker.app>"
  }
  if (!mailConfigured()) {
    console.error("Mail is not configured (RESEND_API_KEY / SMTP_URL).")
    process.exit(1)
  }

  const unsub = mailUnsubscribeUrl(to)
  if (!unsub.startsWith("https://foresightmatchmaker.app/")) {
    console.error("Refuse to send: unsubscribe URL origin is wrong:", unsub)
    process.exit(1)
  }
  const mail = renderBerlinClaudeInviteEmail(unsub)
  const result = await sendMail({
    to,
    subject: `[DEMO] ${mail.subject}`,
    text: mail.text,
    html: mail.html,
    replyTo: "hello@foresightmatchmaker.app",
    idempotencyKey: `thank-you/demo-berlin-claude/${to}/${Date.now()}`,
    headers: {
      "List-Unsubscribe": `<${unsub}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  })

  if (!result.sent) {
    console.error("Send failed:", result)
    process.exit(1)
  }
  console.log(JSON.stringify({ ok: true, to, subject: `[DEMO] ${mail.subject}`, unsub }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
