import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { randomBytes } from "node:crypto"
import { requestLinkSchema } from "@/lib/api/input"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { getProfilesByEmail } from "@/lib/db/profiles"
import { issueToken } from "@/lib/auth/tokens"
import { magicLinkMode, sendMagicLink, revealLinksAllowed } from "@/lib/auth/mail"
import { rateLimit } from "@/lib/auth/rate-limit"
import { isRegisterPath, needsEmailVerify, safeNextPath } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/auth/request-link
 *
 * Response shape is identical for known and unknown emails on bare sign-in
 * (anti-enumeration). Directory browse and register still mint a real
 * confirmation link so a new address can enter.
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
  const verifyUnknown = needsEmailVerify(next)
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
  } else if (verifyUnknown) {
    // Confirm the address first (add a listing, or browse with no listing yet).
    const token = issueToken(email)
    const link = `${origin}/claim/${token}${nextQuery}`
    const kind = isRegisterPath(next) ? "welcome" : "signin"
    const mail = await sendMagicLink(email, link, kind)
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
