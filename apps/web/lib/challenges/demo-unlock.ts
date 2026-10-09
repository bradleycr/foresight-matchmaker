import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { CHALLENGES, challengeBySlug, type ChallengeId } from "./catalog"

/**
 * Secret link → cookie unlock for a preview programme.
 *
 * Production keeps preview programmes off the public desk. A signed cookie
 * lets you share one URL with a partner (e.g. AI Safety Berlin) so they can
 * walk the product without Recoding Medicine applicants seeing it.
 */

export const DEMO_COOKIE = "mm_demo"
const MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30 days

export type DemoUnlock = {
  programme: ChallengeId
  /** When true, hide every other programme for this browser. */
  solo: boolean
}

function unlockSecret(): string | null {
  const dedicated = process.env.PREVIEW_DEMO_SECRET?.trim()
  if (dedicated) return dedicated
  const session = process.env.SESSION_SECRET?.trim()
  return session && session.length > 0 ? session : null
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Encode unlock for Set-Cookie. */
export function sealDemoUnlock(unlock: DemoUnlock, secret = unlockSecret()): string | null {
  if (!secret) return null
  const payload = `${unlock.solo ? "solo" : "also"}:${unlock.programme}`
  return `${payload}.${sign(payload, secret)}`
}

export function parseDemoUnlock(raw: string | undefined | null, secret = unlockSecret()): DemoUnlock | null {
  if (!raw || !secret) return null
  const dot = raw.lastIndexOf(".")
  if (dot <= 0) return null
  const payload = raw.slice(0, dot)
  const mac = raw.slice(dot + 1)
  if (!safeEqual(mac, sign(payload, secret))) return null
  const [mode, id] = payload.split(":")
  if ((mode !== "solo" && mode !== "also") || !id) return null
  if (!CHALLENGES.some((c) => c.id === id)) return null
  return { programme: id as ChallengeId, solo: mode === "solo" }
}

export function resolveDemoProgramme(raw: string | undefined | null): ChallengeId | null {
  if (!raw?.trim()) return null
  const needle = raw.trim()
  const bySlug = challengeBySlug(needle)
  if (bySlug) return bySlug.id
  return CHALLENGES.find((c) => c.id === needle)?.id ?? null
}

export function demoTokenValid(token: string | undefined | null): boolean {
  const secret = unlockSecret()
  if (!secret || !token) return false
  return safeEqual(token, secret)
}

export async function readDemoUnlock(): Promise<DemoUnlock | null> {
  const jar = await cookies()
  return parseDemoUnlock(jar.get(DEMO_COOKIE)?.value)
}

export function demoCookieOptions(value: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
    value,
  }
}
