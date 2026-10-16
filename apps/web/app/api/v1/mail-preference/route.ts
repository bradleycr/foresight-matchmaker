import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { forbidden, unavailable, zodError, badRequest } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { durableEnabled } from "@/lib/db/durable-store"
import {
  clearMailOptOut,
  isMailOptedOut,
  recordMailOptOut,
} from "@/lib/mail/optout-store"
import { recordNudgeOptOut } from "@/lib/nudge/store"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  /** true = receive programme announcements; false = stop them. */
  programme_emails: z.boolean(),
})

/**
 * GET/PATCH /api/v1/mail-preference — signed-in control for programme mail.
 * Magic-link sign-in is always allowed; this only gates announcements.
 */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session) return forbidden("Sign in required.")
  if (!durableEnabled()) return unavailable("Durable storage is required.")

  const optedOut = await isMailOptedOut(session.email)
  return NextResponse.json({
    email: session.email,
    programme_emails: !optedOut,
  })
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const session = await getSession()
  if (!session) return forbidden("Sign in required.")
  if (!durableEnabled()) return unavailable("Durable storage is required.")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input: z.infer<typeof patchSchema>
  try {
    input = patchSchema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) return zodError(error)
    throw error
  }

  if (input.programme_emails) {
    await clearMailOptOut(session.email)
  } else {
    await recordMailOptOut(session.email, "profile")
    await recordNudgeOptOut(session.email)
  }

  return NextResponse.json({
    email: session.email,
    programme_emails: input.programme_emails,
  })
}
