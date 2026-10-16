import { createHmac, timingSafeEqual } from "node:crypto"
import { publicOrigin } from "@/lib/public-origin"

/**
 * One-click unsubscribe for programme / announcement mail (not magic links).
 * Separate HMAC version from listing-reminder stops so rotating one does not
 * accidentally revive the other.
 */

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production")
  return "dev-only-insecure-secret"
}

function sign(email: string): string {
  return createHmac("sha256", secret()).update(`mail-optout-v1:${email}`).digest("base64url")
}

export function encodeMailOptOutToken(email: string): string {
  const mailbox = email.trim().toLowerCase()
  const payload = Buffer.from(mailbox, "utf8").toString("base64url")
  return `${payload}.${sign(mailbox)}`
}

export function decodeMailOptOutToken(token: string | null | undefined): string | null {
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

export function mailUnsubscribeUrl(email: string): string {
  return `${publicOrigin()}/api/mail/unsubscribe?t=${encodeURIComponent(encodeMailOptOutToken(email))}`
}
