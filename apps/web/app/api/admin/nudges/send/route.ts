import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { forbidden, unavailable, zodError, badRequest } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { CHALLENGE_ID, type ChallengeId } from "@/lib/challenges/catalog"
import { durableEnabled } from "@/lib/db/durable-store"
import { mailConfigured } from "@/lib/auth/mail"
import { hydrateListings } from "@/lib/db/durable"
import { collectSignupRows } from "@/lib/db/signups"
import { looksLikeRecipient } from "@/lib/nudge/policy"
import { runListingNudges } from "@/lib/nudge/run"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const sendSchema = z
  .object({
    challenge: z.enum(CHALLENGE_ID).optional(),
    emails: z.array(z.string().email()).max(25).optional(),
    unfinished: z.boolean().optional(),
  })
  .refine((value) => (value.emails && value.emails.length > 0) || value.unfinished === true, {
    message: "Provide emails or unfinished=true.",
  })

/**
 * POST /api/admin/nudges/send — operator-triggered listing reminders.
 *
 * Selected mailboxes skip the week wait and the programme switch (you
 * picked them). An unpublished batch still skips people already reminded
 * or opted out.
 */
export async function POST(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")
  if (!mailConfigured()) return unavailable("Mail is not configured.")
  if (!durableEnabled()) return unavailable("Durable storage is required to send reminders.")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Request body must be JSON.")
  }

  let input: z.infer<typeof sendSchema>
  try {
    input = sendSchema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) return zodError(error)
    throw error
  }

  const emails = input.emails?.map((value) => value.trim().toLowerCase()).filter(looksLikeRecipient)
  if (input.emails && (!emails || emails.length === 0)) {
    return badRequest("No valid recipient addresses.")
  }

  await hydrateListings()
  const rows = await collectSignupRows(input.challenge ? { challengeId: input.challenge } : undefined)
  const selected = Boolean(emails && emails.length > 0)

  const result = await runListingNudges({
    rows,
    emails: emails ? new Set(emails) : undefined,
    challengeId: input.challenge as ChallengeId | undefined,
    requireAge: false,
    requireAutoNudge: false,
    includeReminded: selected,
  })

  return NextResponse.json(result)
}
