import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ok, badRequest, unauthorized, zodError } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { rateLimit } from "@/lib/auth/rate-limit"
import { llmEnabled } from "@/lib/llm/client"
import { proposeProfile } from "@/lib/llm/prefill"
import { composeNarrative } from "@/lib/llm/narrative"
import { proposalIsSubstantial } from "@/lib/llm/proposal-utils"
import { logEvent } from "@/lib/db/events"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  text: z.string().min(40, "Paste at least a sentence or two.").max(8000),
  source: z.enum(["chat", "paste"]).optional(),
})

/**
 * POST /api/v1/prefill — propose structured profile fields from prose.
 *
 * Explicitly user-initiated; returns 503 when no LLM is configured.
 * Nothing is written to the database — the human confirms on the form.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!llmEnabled()) {
    return NextResponse.json(
      { error: "Pre-fill is not available on this deployment. Fill in the form directly.", code: "disabled" },
      { status: 503 },
    )
  }

  const session = await getSession()
  if (!session) return unauthorized("Confirm your email before pre-filling a profile.")

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limited = rateLimit(`prefill:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many pre-fill requests. Wait a few minutes, or fill in the form directly.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return zodError(parsed.error)

  const [proposal, narrative] = await Promise.all([
    proposeProfile(parsed.data.text),
    composeNarrative({ sourceText: parsed.data.text }),
  ])
  if (!proposal) {
    return NextResponse.json(
      { error: "Could not derive a proposal from that text. Try more detail, or fill in the form directly.", code: "extraction_failed" },
      { status: 400 },
    )
  }

  if (narrative) {
    proposal.one_liner = narrative.one_liner
    proposal.summary = narrative.summary
  }

  if (!proposalIsSubstantial(proposal)) {
    return NextResponse.json(
      {
        error: "Not enough to fill the form — include your organisation name and what you do.",
        code: "insubstantial",
      },
      { status: 400 },
    )
  }

  logEvent("prefill_used", null, { source: parsed.data.source ?? "unknown" })
  return ok({ proposal })
}
