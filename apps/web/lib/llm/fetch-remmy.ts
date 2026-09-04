import type { AskId } from "@/lib/remmy/ask"
import type { RemmyMode } from "@/lib/llm/remmy"

export interface RemmyTurnPayload {
  reply: string
  ready_for_review: boolean
  draft_summary: string[]
  ask?: AskId | null
}

/**
 * One Remmy turn. Prefers SSE (`delta` then `turn`) so the reply can paint
 * as tokens arrive; falls back to a single JSON body.
 */
export async function fetchRemmyTurn(
  body: {
    mode: RemmyMode
    messages: Array<{ role: "user" | "assistant"; content: string }>
    current_profile: Record<string, unknown>
    open_gaps: string[]
    required_gaps?: string[]
    optional_gaps?: string[]
    answered_asks: string[]
  },
  opts?: { onDelta?: (reply: string) => void },
): Promise<RemmyTurnPayload> {
  const res = await fetch("/api/v1/remmy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(err?.error ?? "Remmy could not respond.")
  }

  const ctype = res.headers.get("content-type") ?? ""
  if (ctype.includes("text/event-stream") && res.body) {
    return readSseTurn(res.body, opts?.onDelta)
  }

  return (await res.json()) as RemmyTurnPayload
}

async function readSseTurn(
  stream: ReadableStream<Uint8Array>,
  onDelta?: (reply: string) => void,
): Promise<RemmyTurnPayload> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let turn: RemmyTurnPayload | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split("\n\n")
    buffer = chunks.pop() ?? ""
    for (const chunk of chunks) {
      const event = parseSseChunk(chunk)
      if (!event) continue
      if (event.event === "delta" && typeof event.data.reply === "string") {
        onDelta?.(event.data.reply)
      }
      if (event.event === "turn") {
        turn = event.data as unknown as RemmyTurnPayload
      }
      if (event.event === "error") {
        throw new Error(typeof event.data.error === "string" ? event.data.error : "Remmy could not respond.")
      }
    }
  }

  if (!turn) throw new Error("Remmy could not respond.")
  return turn
}

function parseSseChunk(chunk: string): { event: string; data: Record<string, unknown> } | null {
  let event = "message"
  const dataLines: string[] = []
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
  }
  if (dataLines.length === 0) return null
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as Record<string, unknown> }
  } catch {
    return null
  }
}
