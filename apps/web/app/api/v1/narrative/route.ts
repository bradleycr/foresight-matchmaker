import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ok, unauthorized, zodError } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { rateLimit } from "@/lib/auth/rate-limit"
import { llmEnabled } from "@/lib/llm/client"
import { composeNarrative } from "@/lib/llm/narrative"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  text: z.string().min(20).max(8000),
  facts: z.record(z.unknown()).optional(),
})

/** POST /api/v1/narrative — rewrite one_liner + summary from known facts. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!llmEnabled()) {
    return NextResponse.json({ error: "Rewrite is not available.", code: "disabled" }, { status: 503 })
  }

  const session = await getSession()
  if (!session) return unauthorized("Confirm your email first.")

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limited = rateLimit(`narrative:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many rewrite requests." }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return zodError(parsed.error)

  const draft = await composeNarrative({ sourceText: parsed.data.text, facts: parsed.data.facts })
  if (!draft) {
    return NextResponse.json({ error: "Could not rewrite that just now." }, { status: 400 })
  }

  return ok(draft)
}
