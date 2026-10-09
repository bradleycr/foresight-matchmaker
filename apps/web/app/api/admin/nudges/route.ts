import { NextRequest, NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { forbidden, unavailable, zodError, badRequest } from "@/lib/api/respond"
import { isAdmin } from "@/lib/auth/admin"
import { CHALLENGES, CHALLENGE_ID, programmeAutoNudge, type ChallengeId } from "@/lib/challenges/catalog"
import { durableEnabled } from "@/lib/db/durable-store"
import { mailConfigured } from "@/lib/auth/mail"
import { autoNudgeByProgramme, saveNudgeOverride } from "@/lib/nudge/settings"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  challenge: z.enum(CHALLENGE_ID),
  autoNudge: z.boolean(),
})

/**
 * GET /api/admin/nudges — current reminder switch per programme.
 */
export async function GET(): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")

  const autoNudge = await autoNudgeByProgramme()
  return NextResponse.json({
    mailConfigured: mailConfigured(),
    durable: durableEnabled(),
    programmes: CHALLENGES.map((challenge) => ({
      id: challenge.id,
      slug: challenge.slug,
      autoNudge: autoNudge[challenge.id],
      catalogDefault: programmeAutoNudge(challenge.id),
    })),
  })
}

/**
 * PATCH /api/admin/nudges — persist the operator's on/off for one programme.
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  if (!(await isAdmin())) return forbidden("Admin access required.")
  if (!durableEnabled()) {
    return unavailable("Durable storage is required to save reminder settings.")
  }

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

  await saveNudgeOverride(input.challenge as ChallengeId, input.autoNudge)
  const autoNudge = await autoNudgeByProgramme()
  return NextResponse.json({
    ok: true,
    challenge: input.challenge,
    autoNudge: autoNudge[input.challenge as ChallengeId],
  })
}
