import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { randomBytes } from "node:crypto"
import { requestLinkSchema } from "@/lib/api/input"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { getProfilesByEmail } from "@/lib/db/profiles"
import { issueToken } from "@/lib/auth/tokens"
import { magicLinkMode, sendMagicLink, revealLinksAllowed } from "@/lib/auth/mail"
import { rateLimit } from "@/lib/auth/rate-limit"
import { isRegisterPath, safeNextPath } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/auth/request-link
 *
 * Response shape is identical for known and unknown emails on the sign-in
 * path (anti-enumeration). The register path is different on purpose: a
 * new address must receive a real confirmation link so they can verify
 * before filling a listing.
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
  const next = safeNextPath(input.next)
  const signup = isRegisterPath(next)
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ""

  let claimLink: string | undefined

  if (profiles.length > 0) {
    // One profile per email is the product rule; if duplicates exist, bind
    // the oldest so behaviour is deterministic.
    const profile = profiles[0]!
    const token = issueToken(email, profile.id)
    const link = `${origin}/claim/${token}${nextQuery}`
    const mail = await sendMagicLink(email, link, "signin")
    // Only reveal on-screen when the inbox did not get the link — otherwise
    // auto-claim burns the token and the emailed button fails.
    if (reveal && !mail.sent) claimLink = link
  } else if (signup) {
    // Confirm the address first; the listing does not exist yet.
    const token = issueToken(email)
    const link = `${origin}/claim/${token}${nextQuery}`
    const mail = await sendMagicLink(email, link, "welcome")
    if (reveal && !mail.sent) claimLink = link
  } else if (reveal) {
    // Decoy: same URL shape, never stored — claim fails with the generic error.
    // Equalises response shape so existence cannot be inferred from JSON keys.
    claimLink = `${origin}/claim/${randomBytes(32).toString("base64url")}${nextQuery}`
    await new Promise((r) => setTimeout(r, 5))
  } else {
    randomBytes(32)
  }

  return ok({
    ok: true,
    mode,
    ...(reveal && claimLink ? { claim_link: claimLink } : {}),
  })
}
