import { createHash, randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDb } from "../db/client"
import { authTokens } from "../db/schema"
import { logEvent } from "../db/events"

/**
 * Magic-link tokens. Self-implemented — no third-party auth provider.
 *
 * - 32 random bytes, sent to the user as base64url.
 * - Only the SHA-256 hash is stored; a DB leak leaks nothing usable.
 * - Single use, 24h expiry.
 *
 * When SMTP is unset, the link is logged server-side. On-screen reveal is
 * opt-in via AUTH_REVEAL_LINKS (default on in development only).
 */

const TOKEN_TTL_HOURS = 24

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/** Issue a token for an email (optionally bound to a specific profile). */
export function issueToken(email: string, profileId?: string): string {
  const token = randomBytes(32).toString("base64url")
  const now = new Date()

  getDb()
    .insert(authTokens)
    .values({
      tokenHash: hashToken(token),
      email: email.toLowerCase(),
      profileId: profileId ?? null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    })
    .run()

  logEvent("magic_link_issued", profileId ?? null, {})
  return token
}

export type ConsumeResult =
  | { ok: true; email: string; profileId: string | null }
  | { ok: false; error: "invalid" | "expired" | "used" }

/** Validate and burn a token. Each token works exactly once. */
export function consumeToken(token: string): ConsumeResult {
  const db = getDb()
  const row = db.select().from(authTokens).where(eq(authTokens.tokenHash, hashToken(token))).get()

  if (!row) return { ok: false, error: "invalid" }
  if (row.usedAt) return { ok: false, error: "used" }
  if (row.expiresAt < new Date().toISOString()) return { ok: false, error: "expired" }

  db.update(authTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(authTokens.tokenHash, row.tokenHash))
    .run()

  return { ok: true, email: row.email, profileId: row.profileId }
}
