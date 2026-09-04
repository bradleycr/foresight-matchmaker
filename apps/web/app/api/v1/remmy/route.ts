import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ok, badRequest, unauthorized, zodError } from "@/lib/api/respond"
import { getSession } from "@/lib/auth/session"
import { rateLimit } from "@/lib/auth/rate-limit"
import { llmEnabled } from "@/lib/llm/client"
import { remmyTurn, remmyTurnStream } from "@/lib/llm/remmy"
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
  open_gaps: z.array(z.string().max(64)).max(24).optional(),
  required_gaps: z.array(z.string().max(64)).max(24).optional(),
  optional_gaps: z.array(z.string().max(64)).max(24).optional(),
  answered_asks: z.array(z.string().max(64)).max(24).optional(),
})

/**
 * POST /api/v1/remmy — one conversational turn (interview only).
 *
 * Accept: text/event-stream streams `delta` then `turn`. Otherwise JSON.
 */
export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  if (!llmEnabled()) {
    return NextResponse.json(
      { error: "Remmy is not available on this deployment. Use the traditional form." },
      { status: 503 },
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return zodError(parsed.error)

  const session = await getSession()
  if (!session) return unauthorized("Confirm your email before talking to Remmy.")
  if (parsed.data.mode === "update" && !session.profileId) return unauthorized()

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const limited = rateLimit(`remmy:${ip}`, { limit: 30, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many Remmy turns. Wait a few minutes, or use the traditional form." },
      { status: 429 },
    )
  }

  const last = parsed.data.messages[parsed.data.messages.length - 1]
  if (last.role !== "user") {
    return badRequest("The last message must be from the user.")
  }

  const turnInput = {
    mode: parsed.data.mode,
    messages: parsed.data.messages,
    currentProfile: parsed.data.current_profile ?? null,
    openGaps: parsed.data.open_gaps ?? [],
    requiredGaps: parsed.data.required_gaps ?? parsed.data.open_gaps ?? [],
    optionalGaps: parsed.data.optional_gaps ?? [],
    answeredAsks: parsed.data.answered_asks ?? [],
  }

  const wantsStream = (req.headers.get("accept") ?? "").includes("text/event-stream")
  if (wantsStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }
        try {
          let emitted = false
          for await (const ev of remmyTurnStream(turnInput)) {
            emitted = true
            send(ev.event, ev.data)
            if (ev.event === "turn") {
              logEvent("remmy_turn", null, {
                mode: parsed.data.mode,
                ready_for_review: "ready_for_review" in ev.data ? ev.data.ready_for_review : false,
              })
            }
          }
          if (!emitted) send("error", { error: "Remmy could not respond just now. Try again, or use the traditional form." })
        } catch {
          send("error", { error: "Remmy could not respond just now. Try again, or use the traditional form." })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    })
  }

  const turn = await remmyTurn(turnInput)

  if (!turn) {
    return badRequest("Remmy could not respond just now. Try again, or use the traditional form.")
  }

  logEvent("remmy_turn", null, {
    mode: parsed.data.mode,
    ready_for_review: turn.ready_for_review,
  })

  return ok(turn)
}
