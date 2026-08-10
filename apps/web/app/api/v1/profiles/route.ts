import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { toPublicProfile } from "@rmm/schema"
import { profileInputSchema } from "@/lib/api/input"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { saveProfile, slugFor } from "@/lib/db/profiles"
import { issueToken } from "@/lib/auth/tokens"
import { sendMagicLink, revealLinksAllowed } from "@/lib/auth/mail"
import { createSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/profiles — create a profile.
 *
 * Open to the public (this is how the directory grows during the webinar).
 * The submitter is signed in immediately. A claim link is emailed when SMTP
 * is configured; otherwise returned only when on-screen reveal is allowed
 * (safe: they just created the account — not an enumeration oracle).
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
    input = profileInputSchema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  const profile = saveProfile({ ...input, slug: slugFor(input.org_name) }, { isNew: true })

  const token = issueToken(profile.contact_email, profile.id)
  const origin = process.env.APP_URL ?? req.nextUrl.origin
  const claimLink = `${origin}/claim/${token}`
  const mail = await sendMagicLink(profile.contact_email, claimLink)

  await createSession(profile.id, profile.contact_email)

  return ok(
    {
      profile: toPublicProfile(profile),
      email_sent: mail.sent,
      ...(revealLinksAllowed() ? { claim_link: claimLink } : {}),
    },
    { status: 201 },
  )
}
