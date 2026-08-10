import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ok, unauthorized, notFound, zodError, badRequest } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { getProfileById } from "@/lib/db/profiles"
import { getShortlist } from "@/lib/db/matches"
import { llmEnabled } from "@/lib/llm/client"
import { explainMatch, templateRationale } from "@/lib/llm/rationale"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  other_id: z.string().uuid(),
})

/**
 * POST /api/v1/matches/rationale — optional LLM polish for one match.
 *
 * Kept off the shortlist GET so ranking stays under 50ms with no LLM on the
 * interactive path. The client shows the template immediately and upgrades
 * this response when an LLM is configured.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return unauthorized()

  const subject = getProfileById(session.profileId)
  if (!subject) return notFound("Your profile no longer exists.")

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return zodError(parsed.error)

  const entry = getShortlist(subject.id).find((m) => m.otherId === parsed.data.other_id)
  if (!entry) return badRequest("That profile is not on your shortlist.")

  const other = getProfileById(entry.otherId)
  if (!other) return notFound()

  const input = {
    subjectName: subject.org_name,
    otherName: other.org_name,
    score: entry.score,
    factors: entry.factors,
  }

  // With no LLM, return the template immediately (same as the page already has).
  const rationale = llmEnabled() ? await explainMatch(input) : templateRationale(input)
  return ok({ other_id: other.id, rationale, source: llmEnabled() ? "llm_or_template" : "template" })
}
