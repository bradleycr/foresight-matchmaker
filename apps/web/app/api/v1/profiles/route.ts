import { NextRequest } from "next/server"
import { ZodError } from "zod"
import { toPublicProfile } from "@rmm/schema"
import { profileInputSchema } from "@/lib/api/input"
import { ok, zodError, badRequest } from "@/lib/api/respond"
import { saveProfile, slugFor } from "@/lib/db/profiles"
import { issueToken } from "@/lib/auth/tokens"
import { sendMagicLink, smtpConfigured } from "@/lib/auth/mail"
import { createSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/profiles — create a profile.
 *
 * Open to the public (this is how the directory grows during the webinar).
 * The submitter is signed in immediately. When SMTP is configured, a
 * magic link is also emailed so they can return on another device.
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

  let profile
  try {
    profile = saveProfile({ ...input, slug: slugFor(input.org_name) }, { isNew: true })
  } catch (e) {
    if (e instanceof ZodError) return zodError(e)
    throw e
  }

  let emailSent = false
  if (smtpConfigured()) {
    const token = issueToken(profile.contact_email, profile.id)
    const origin = process.env.APP_URL ?? req.nextUrl.origin
    const mail = await sendMagicLink(profile.contact_email, `${origin}/claim/${token}`)
    emailSent = mail.sent
  }

  await createSession(profile.id, profile.contact_email)

  return ok(
    {
      profile: toPublicProfile(profile),
      email_sent: emailSent,
    },
    { status: 201 },
  )
}
