import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import { requestLinkSchema } from "@/lib/api/input"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { getProfilesByEmail } from "@/lib/db/profiles"
import { issueToken } from "@/lib/auth/tokens"
import { magicLinkMode, sendMagicLink, revealLinksAllowed } from "@/lib/auth/mail"
import { rateLimit } from "@/lib/auth/rate-limit"
import { safeNextPath } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/auth/request-link
 *
 * Every address gets a real magic link. Confirming the mailbox is the point
 * of SMTP — whether a profile exists yet is decided after they click.
 * Known emails bind the oldest listing; unknown emails get a session with
 * no listing and land on /register (or the `next` they asked for).
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
  // Per email, not per venue IP — a webinar of 50 people on one Wi-Fi
  // must not share a single bucket. 12/15min covers retries and typos.
  const limited = rateLimit(`request-link:${ip}:${email}`, { limit: 12, windowMs: 15 * 60 * 1000 })
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
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : ""

  const profile = profiles[0]
  const token = issueToken(email, profile?.id)
  const link = `${origin}/claim/${token}${nextQuery}`
  const kind = profile ? "signin" : "welcome"
  const mail = await sendMagicLink(email, link, kind)

  // Only reveal on-screen when the inbox did not get the link — otherwise
  // auto-claim burns the token and the emailed button fails.
  const claimLink = reveal && !mail.sent ? link : undefined

  return ok({
    ok: true,
    mode,
    ...(claimLink ? { claim_link: claimLink } : {}),
  })
}
