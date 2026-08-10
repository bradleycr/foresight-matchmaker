import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { randomBytes } from "node:crypto"
import { requestLinkSchema } from "@/lib/api/input"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { getProfilesByEmail } from "@/lib/db/profiles"
import { issueToken } from "@/lib/auth/tokens"
import { magicLinkMode, sendMagicLink, revealLinksAllowed } from "@/lib/auth/mail"
import { rateLimit } from "@/lib/auth/rate-limit"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/auth/request-link
 *
 * Response shape is identical for known and unknown emails (anti-enumeration).
 * When on-screen reveal is enabled, unknown emails still get a claim_link —
 * a decoy that fails at /claim with the same generic error as a bad token.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input
  try {
    input = requestLinkSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  const email = input.email.toLowerCase()
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  const limited = rateLimit(`request-link:${ip}:${email}`, { limit: 5, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many sign-in requests. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  const profiles = getProfilesByEmail(email)
  const origin = process.env.APP_URL ?? req.nextUrl.origin
  const mode = magicLinkMode()
  const reveal = revealLinksAllowed()

  let claimLink: string | undefined

  if (profiles.length > 0) {
    // One profile per email is the product rule; if duplicates exist, bind
    // the oldest so behaviour is deterministic.
    const profile = profiles[0]!
    const token = issueToken(email, profile.id)
    const link = `${origin}/claim/${token}`
    await sendMagicLink(email, link)
    if (reveal) claimLink = link
  } else if (reveal) {
    // Decoy: same URL shape, never stored — claim fails with the generic error.
    // Equalises response shape so existence cannot be inferred from JSON keys.
    claimLink = `${origin}/claim/${randomBytes(32).toString("base64url")}`
    // Rough timing parity with issueToken + log path.
    await new Promise((r) => setTimeout(r, 5))
  } else {
    // Opaque path: burn a little CPU so known/unknown aren't free to time.
    randomBytes(32)
  }

  // Identical public contract in every mode. `claim_link` is only present
  // when reveal is explicitly allowed — and then it is present for BOTH
  // known and unknown emails (real vs decoy).
  return ok({
    ok: true,
    mode,
    ...(reveal && claimLink ? { claim_link: claimLink } : {}),
  })
}
