import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ok, badRequest, unauthorized, zodError } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { rateLimit } from "@/lib/auth/rate-limit"
import { llmEnabled } from "@/lib/llm/client"
import { remmyTurn } from "@/lib/llm/remmy"
import { logEvent } from "@/lib/db/events"

export const dynamic = "force-dynamic"

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
})

const bodySchema = z.object({
  mode: z.enum(["create", "update"]).default("create"),
  messages: z.array(messageSchema).min(1).max(24),
  current_profile: z.record(z.unknown()).optional().nullable(),
  /** Build a form draft from the chat now — no more clarifying questions. */
  force_draft: z.boolean().optional().default(false),
})

/**
 * POST /api/v1/remmy — one conversational turn with Remmy.
 *
 * Never writes a profile. Returns a reply and optionally a draft proposal
 * that the client must show for human confirmation before applying to the form.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!llmEnabled()) {
    return NextResponse.json(
      { error: "Remmy is not available on this deployment. Use the traditional form." },
      { status: 503 },
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return zodError(parsed.error)

  // Update mode carries the owner's profile into the model — require a session.
  if (parsed.data.mode === "update") {
    const session = await getSession()
    if (!session) return unauthorized()
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limited = rateLimit(`remmy:${ip}`, { limit: 30, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many Remmy turns. Wait a few minutes, or use the traditional form." },
      { status: 429 },
    )
  }

  // force_draft may end with an assistant-only history (user clicked fill-form
  // without a new message). Inject a synthetic user cue so validation + the model agree.
  let messages = parsed.data.messages
  if (parsed.data.force_draft) {
    const last = messages[messages.length - 1]
    if (!last || last.role !== "user") {
      messages = [
        ...messages,
        {
          role: "user" as const,
          content: "Please fill the form from everything I have told you so far.",
        },
      ]
    }
  } else {
    const last = messages[messages.length - 1]
    if (!last || last.role !== "user") {
      return badRequest("The last message must be from the user.")
    }
  }

  const turn = await remmyTurn({
    mode: parsed.data.mode,
    messages,
    currentProfile: parsed.data.mode === "update" ? parsed.data.current_profile ?? null : null,
    forceDraft: parsed.data.force_draft,
  })

  if (!turn) {
    return badRequest("Remmy could not respond just now. Try again, or use the traditional form.")
  }

  logEvent("remmy_turn", null, {
    mode: parsed.data.mode,
    ready_for_review: turn.ready_for_review,
    force_draft: parsed.data.force_draft,
  })

  return ok(turn)
}
