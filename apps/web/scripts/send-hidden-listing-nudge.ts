/**
 * One-shot: people who published but left visibility on Hidden.
 * Prints counts only — never recipient addresses.
 */
import { readFileSync } from "node:fs"
import { renderHiddenListingEmail } from "../lib/auth/mail-templates.ts"

const FROM = "Foresight Matchmaking <noreply@foresightmatchmaker.app>"
const REPLY_TO = "hello@foresightmatchmaker.app"
const DAY = new Date().toISOString().slice(0, 10)

async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error("missing RESEND_API_KEY")
  const path = process.argv[2]
  if (!path) throw new Error("usage: send-hidden-listing-nudge.ts <emails.json>")
  const emails = (JSON.parse(readFileSync(path, "utf8")) as string[])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@") && !e.endsWith(".invalid") && e !== "bradley@foresight.org")
  const unique = [...new Set(emails)]
  const mail = renderHiddenListingEmail()
  const payload = unique.map((to) => ({
    from: FROM,
    to: [to],
    reply_to: [REPLY_TO],
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    tags: [
      { name: "email_type", value: "profile-nudge-hidden" },
      { name: "programme", value: "recoding-medicine" },
    ],
  }))
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `batch-profile-nudge/hidden/${DAY}/0`,
      "User-Agent": "foresight-matchmaker/nudge-blast",
    },
    body: JSON.stringify(payload),
  })
  const dailyQuota = res.headers.get("x-resend-daily-quota")
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.log(JSON.stringify({ ok: false, status: res.status, dailyQuota, error: body }, null, 2))
    process.exit(1)
  }
  const ids = Array.isArray(body) ? body : body.data
  console.log(
    JSON.stringify(
      {
        ok: true,
        attempted: unique.length,
        accepted: Array.isArray(ids) ? ids.length : unique.length,
        dailyQuota,
        subject: mail.subject,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(String(err))
  process.exit(1)
})
