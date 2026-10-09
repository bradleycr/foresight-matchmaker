import { createHmac, timingSafeEqual } from "node:crypto"
import { publicOrigin } from "@/lib/public-origin"

/**
 * One-click stop token. Payload is the mailbox; signature is HMAC of a
 * versioned string so a rotated `SESSION_SECRET` invalidates outstanding
 * links the same way magic links already do.
 */

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production")
  return "dev-only-insecure-secret"
}

function sign(email: string): string {
  return createHmac("sha256", secret()).update(`listing-nudge-stop-v1:${email}`).digest("base64url")
}

export function encodeStopToken(email: string): string {
  const mailbox = email.trim().toLowerCase()
  const payload = Buffer.from(mailbox, "utf8").toString("base64url")
  return `${payload}.${sign(mailbox)}`
}

export function decodeStopToken(token: string | null | undefined): string | null {
  if (!token) return null
  const sep = token.lastIndexOf(".")
  if (sep < 0) return null
  const payload = token.slice(0, sep)
  const sig = token.slice(sep + 1)
  let email: string
  try {
    email = Buffer.from(payload, "base64url").toString("utf8").trim().toLowerCase()
  } catch {
    return null
  }
  if (!email.includes("@")) return null
  const expected = sign(email)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return email
}

export function stopRemindersUrl(email: string): string {
  return `${publicOrigin()}/api/nudge/stop?t=${encodeURIComponent(encodeStopToken(email))}`
}
