/**
 * One-shot Recoding Medicine nudge. Not imported by the app.
 * Prints counts only — never recipient addresses.
 */
import { renderProfileNudgeEmail, type ProfileNudgeKind } from "../lib/auth/mail-templates.ts"

const FROM = "Foresight Matchmaking <noreply@foresightmatchmaker.app>"
const REPLY_TO = "hello@foresightmatchmaker.app"
const SKIP = new Set(["bradley@foresight.org"])
const CHUNK = 20
const UNPUBLISHED_CAP = 100
const DAY = new Date().toISOString().slice(0, 10)

type Signup = {
  status: string
  contact_email: string
  created_at: string
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function sortOldest(rows: Signup[]): Signup[] {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.contact_email.localeCompare(b.contact_email))
}

function unique(rows: Signup[]): Signup[] {
  const seen = new Set<string>()
  const out: Signup[] = []
  for (const row of rows) {
    const email = row.contact_email.trim().toLowerCase()
    if (!email || SKIP.has(email) || !looksLikeEmail(email) || seen.has(email)) continue
    if (email.endsWith(".invalid") || email.endsWith("@resend.dev")) continue
    seen.add(email)
    out.push({ ...row, contact_email: email })
  }
  return out
}

async function loginAndFetch(): Promise<Signup[]> {
  const jar: string[] = []
  const login = await fetch("https://foresightmatchmaker.app/api/admin/login", {
    method: "POST",
    redirect: "manual",
    body: (() => {
      const form = new FormData()
      form.set("secret", "FSRM2026!")
      form.set("next", "/admin")
      return form
    })(),
  })
  const setCookie = login.headers.getSetCookie?.() ?? []
  const cookieHeader =
    setCookie.length > 0
      ? setCookie.map((c) => c.split(";")[0]).join("; ")
      : (login.headers.get("set-cookie") ?? "").split(",").map((c) => c.split(";")[0]).join("; ")
  jar.push(cookieHeader)
  const res = await fetch("https://foresightmatchmaker.app/api/admin/signups", {
    headers: { cookie: jar.join("; ") },
  })
  if (!res.ok) throw new Error(`signups ${res.status}`)
  const data = (await res.json()) as { signups: Signup[] }
  return data.signups ?? []
}

type SendResult = {
  kind: ProfileNudgeKind
  attempted: number
  accepted: number
  dailyQuota: string | null
  stopped: string | null
}

async function sendChunk(
  kind: ProfileNudgeKind,
  emails: string[],
  chunkIndex: number,
): Promise<{ ok: boolean; accepted: number; status: number; dailyQuota: string | null; error: string | null }> {
  const mail = renderProfileNudgeEmail(kind)
  const payload = emails.map((to) => ({
    from: FROM,
    to: [to],
    reply_to: [REPLY_TO],
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    tags: [
      { name: "email_type", value: `profile-nudge-${kind}` },
      { name: "programme", value: "recoding-medicine" },
    ],
  }))
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `batch-profile-nudge/${kind}/${DAY}/${chunkIndex}`,
      "User-Agent": "foresight-matchmaker/nudge-blast",
    },
    body: JSON.stringify(payload),
  })
  const dailyQuota = res.headers.get("x-resend-daily-quota")
  const body = await res.json().catch(() => ({}))
  if (res.ok) {
    const ids = Array.isArray(body) ? body : body.data
    return { ok: true, accepted: Array.isArray(ids) ? ids.length : emails.length, status: res.status, dailyQuota, error: null }
  }
  const message = typeof body?.message === "string" ? body.message : JSON.stringify(body).slice(0, 300)
  return { ok: false, accepted: 0, status: res.status, dailyQuota, error: message }
}

async function sendKind(kind: ProfileNudgeKind, recipients: string[], cap: number): Promise<SendResult> {
  const queue = recipients.slice(0, cap)
  let accepted = 0
  let stopped: string | null = null
  let dailyQuota: string | null = null
  for (let i = 0; i < queue.length; i += CHUNK) {
    const slice = queue.slice(i, i + CHUNK)
    const chunkIndex = Math.floor(i / CHUNK)
    const result = await sendChunk(kind, slice, chunkIndex)
    dailyQuota = result.dailyQuota
    if (!result.ok) {
      stopped = `${result.status} ${result.error}`
      break
    }
    accepted += result.accepted
    const used = Number(result.dailyQuota)
    if (Number.isFinite(used) && used >= 99) {
      stopped = "daily quota nearly full"
      break
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return { kind, attempted: queue.length, accepted, dailyQuota, stopped }
}

async function alreadyNudged(): Promise<Set<string>> {
  const sent = new Set<string>()
  let after: string | undefined
  for (let page = 0; page < 40; page++) {
    const qs = new URLSearchParams({ limit: "100" })
    if (after) qs.set("after", after)
    const res = await fetch(`https://api.resend.com/emails?${qs}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    if (!res.ok) throw new Error(`list emails ${res.status}`)
    const data = (await res.json()) as {
      has_more?: boolean
      data?: Array<{ id: string; to?: string[]; subject?: string; created_at?: string }>
    }
    const rows = data.data ?? []
    if (rows.length === 0) break
    for (const row of rows) {
      if (!row.subject?.includes("Recoding Medicine applications close 16 October")) continue
      for (const to of row.to ?? []) sent.add(to.trim().toLowerCase())
    }
    if (!data.has_more) break
    after = rows[rows.length - 1]?.id
  }
  return sent
}

async function sendRemainderNow(): Promise<void> {
  const rows = await loginAndFetch()
  const already = await alreadyNudged()
  const unpublished = unique(sortOldest(rows.filter((r) => r.status === "confirmed")))
    .map((r) => r.contact_email)
    .filter((email) => !already.has(email))
  const unopened = unique(sortOldest(rows.filter((r) => r.status === "requested")))
    .map((r) => r.contact_email)
    .filter((email) => !already.has(email))

  const unpublishedSend = await sendKind("unpublished", unpublished, unpublished.length)
  const unopenedSend = unpublishedSend.stopped
    ? { kind: "unopened" as const, attempted: 0, accepted: 0, dailyQuota: unpublishedSend.dailyQuota, stopped: "held for quota" }
    : await sendKind("unopened", unopened, unopened.length)

  console.log(
    JSON.stringify(
      {
        day: DAY,
        listed: rows.filter((r) => r.status === "listed").length,
        already_nudged: already.size,
        unpublished_remaining: unpublished.length,
        unopened_remaining: unopened.length,
        unpublished_send: unpublishedSend,
        unpublished_not_sent: Math.max(0, unpublished.length - unpublishedSend.accepted),
        unopened_send: unopenedSend,
        unopened_not_sent: Math.max(0, unopened.length - unopenedSend.accepted),
      },
      null,
      2,
    ),
  )
}

async function main() {
  if (!process.env.RESEND_API_KEY) throw new Error("missing RESEND_API_KEY")
  if (process.argv.includes("--remainder")) {
    await sendRemainderNow()
    return
  }
  const rows = await loginAndFetch()
  const unpublished = unique(sortOldest(rows.filter((r) => r.status === "confirmed"))).map((r) => r.contact_email)
  const unopened = unique(sortOldest(rows.filter((r) => r.status === "requested"))).map((r) => r.contact_email)
  const listed = rows.filter((r) => r.status === "listed").length

  const unpublishedSend = await sendKind("unpublished", unpublished, UNPUBLISHED_CAP)
  const leftoverUnpublished = Math.max(0, unpublished.length - unpublishedSend.accepted)
  const unopenedSend = unpublishedSend.stopped
    ? { kind: "unopened" as const, attempted: 0, accepted: 0, dailyQuota: unpublishedSend.dailyQuota, stopped: "held for quota" }
    : await sendKind("unopened", unopened, unopened.length)

  console.log(
    JSON.stringify(
      {
        listed,
        unpublished_eligible: unpublished.length,
        unopened_eligible: unopened.length,
        unpublished_send: unpublishedSend,
        unpublished_not_sent: leftoverUnpublished,
        unopened_send: unopenedSend,
        unopened_not_sent: Math.max(0, unopened.length - unopenedSend.accepted),
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
