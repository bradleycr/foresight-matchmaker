import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ok, badRequest, zodError } from "@/lib/api/respond"
import { llmEnabled } from "@/lib/llm/client"
import { proposeProfile } from "@/lib/llm/prefill"
import { logEvent } from "@/lib/db/events"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  text: z.string().min(40, "Paste at least a sentence or two.").max(8000),
})

/**
 * POST /api/v1/prefill — propose structured profile fields from prose.
 *
 * Explicitly user-initiated and never on the critical path: the endpoint
 * returns 503 when no LLM is configured and the plain form is always the
 * fully supported alternative. The proposal is a draft for the user to
 * review — nothing is written to the database here.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!llmEnabled()) {
    return NextResponse.json(
      { error: "Pre-fill is not available on this deployment. Fill in the form directly." },
      { status: 503 },
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return zodError(parsed.error)

  const proposal = await proposeProfile(parsed.data.text)
  if (!proposal) {
    return badRequest("Could not derive a proposal from that text. Fill in the form directly.")
  }

  logEvent("prefill_used", null, {})
  return ok({ proposal })
}
