import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ok, badRequest, unauthorized, zodError, notFound } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { rateLimit } from "@/lib/auth/rate-limit"
import { llmEnabled } from "@/lib/llm/client"
import { remmyGuideTurn } from "@/lib/llm/remmy-guide"
import { buildGuideContext, hydrateGuideIntents } from "@/lib/remmy/hydrate-guide"
import { getProfileById } from "@/lib/db/profiles"
import { logEvent } from "@/lib/db/events"

export const dynamic = "force-dynamic"

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(24),
})

/**
 * POST /api/v1/remmy/guide — signed-in Remmy for matches, intros, and gaps.
 *
 * The model returns intents; this route hydrates curated UI parts from the
 * deterministic shortlist. Never writes intros or profile rows.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!llmEnabled()) {
    return NextResponse.json(
      { error: "Remmy is not available on this deployment. Use Your matches for the classic list." },
      { status: 503 },
    )
  }

  const session = await getSession()
  if (!session) return unauthorized()

  const subject = getProfileById(session.profileId)
  if (!subject) return notFound("Your profile no longer exists.")

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return zodError(parsed.error)

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limited = rateLimit(`remmy-guide:${session.profileId}:${ip}`, {
    limit: 40,
    windowMs: 15 * 60 * 1000,
  })
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many Remmy turns. Wait a few minutes, or browse Your matches." },
      { status: 429 },
    )
  }

  const last = parsed.data.messages[parsed.data.messages.length - 1]
  if (last.role !== "user") {
    return badRequest("The last message must be from the user.")
  }

  const context = buildGuideContext(subject)
  const turn = await remmyGuideTurn({
    messages: parsed.data.messages,
    contextJson: JSON.stringify(context).slice(0, 8000),
  })

  if (!turn) {
    return badRequest("Remmy could not respond just now. Try again, or open the classic match list.")
  }

  // If the model forgot intents on an obvious ask, still surface the shortlist.
  let intents = turn.intents
  if (intents.length === 0 && looksLikeMatchAsk(last.content)) {
    intents = [{ type: "show_matches" }]
  }

  const parts = hydrateGuideIntents(subject, intents)

  logEvent("remmy_turn", subject.id, {
    mode: "guide",
    intents: intents.map((i) => i.type),
    parts: parts.map((p) => p.type),
  })

  return ok({ reply: turn.reply, parts })
}

function looksLikeMatchAsk(text: string): boolean {
  return /\b(match|matches|shortlist|partner|partners|connect|intro|introduction|who\b|improve)\b/i.test(
    text,
  )
}
