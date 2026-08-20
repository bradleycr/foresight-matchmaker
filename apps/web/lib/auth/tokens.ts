import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDb } from "../db/client"
import { authTokens } from "../db/schema"
import { logEvent } from "../db/events"

/**
 * Magic links are HMAC-signed, like the session cookie. The payload is in
 * the URL. That matters on Vercel: SQLite lives in /tmp per instance, so a
 * row written when the mail was sent is often missing when they click.
 *
 * We still hash the token into SQLite when we can (local, a warm instance)
 * to catch reuse. A valid signature with no row still succeeds.
 */

const TOKEN_TTL_HOURS = 24

type MagicPayload = {
  t: "ml"
  email: string
  profileId: string | null
  exp: number
  n: string
}

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production")
  return "dev-only-insecure-secret"
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function encodeMagic(payload: MagicPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  // Tilde, not a dot: /claim/[token] must be one path segment Next will not
  // treat as a filename with an extension.
  return `${body}~${sign(body)}`
}

function decodeMagic(token: string): MagicPayload | null {
  const raw = decodeURIComponent(token.trim())
  const sep = raw.lastIndexOf("~")
  if (sep < 0) return null
  const body = raw.slice(0, sep)
  const sig = raw.slice(sep + 1)
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as MagicPayload
    if (parsed.t !== "ml" || typeof parsed.email !== "string") return null
    if (parsed.profileId !== null && typeof parsed.profileId !== "string") return null
    if (typeof parsed.exp !== "number") return null
    return parsed
  } catch {
    return null
  }
}

function rememberIssued(token: string, email: string, profileId: string | null, expiresAt: string): void {
  try {
    getDb()
      .insert(authTokens)
      .values({
        tokenHash: hashToken(token),
        email: email.toLowerCase(),
        profileId,
        createdAt: new Date().toISOString(),
        expiresAt,
      })
      .run()
  } catch {
    // Empty /tmp or a unique-hash clash — the signed URL still works.
  }
}

/** Issue a token for an email (optionally bound to a specific profile). */
export function issueToken(email: string, profileId?: string): string {
  const now = Date.now()
  const expiresAt = new Date(now + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const token = encodeMagic({
    t: "ml",
    email: email.toLowerCase(),
    profileId: profileId ?? null,
    exp: now + TOKEN_TTL_HOURS * 60 * 60 * 1000,
    n: randomBytes(16).toString("base64url"),
  })

  rememberIssued(token, email, profileId ?? null, expiresAt)
  logEvent("magic_link_issued", profileId ?? null, {})
  return token
}

export type ConsumeResult =
  | { ok: true; email: string; profileId: string | null }
  | { ok: false; error: "invalid" | "expired" | "used" }

/** Validate a token. Prefer a DB burn when the row is on this instance. */
export function consumeToken(token: string): ConsumeResult {
  const parsed = decodeMagic(token.trim())
  if (!parsed) return { ok: false, error: "invalid" }
  if (parsed.exp < Date.now()) return { ok: false, error: "expired" }

  try {
    const db = getDb()
    const row = db.select().from(authTokens).where(eq(authTokens.tokenHash, hashToken(token))).get()
    if (row?.usedAt) return { ok: false, error: "used" }
    if (row) {
      db.update(authTokens)
        .set({ usedAt: new Date().toISOString() })
        .where(eq(authTokens.tokenHash, row.tokenHash))
        .run()
    }
  } catch {
    // Cross-instance: no shared SQLite. Signature + expiry are enough.
  }

  return { ok: true, email: parsed.email, profileId: parsed.profileId }
}
