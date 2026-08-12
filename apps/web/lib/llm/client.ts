/**
 * The single LLM gateway (master prompt §8). Callers are optional: every
 * path has a no-LLM fallback. Points at any OpenAI-compatible endpoint.
 *
 * Reasoning models (deepseek-v4-flash et al.) often spend completion tokens
 * on a `reasoning` field before `content`. We request a high max_tokens
 * budget, prefer JSON mode when asked, and fall back to a plain completion
 * if the gateway rejects response_format.
 */

const TIMEOUT_MS = 60_000
const MAX_TOKENS = 4096

export function llmEnabled(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL)
}

interface ChatMessage {
  role: "system" | "user"
  content: string
}

type GatewayMessage = {
  content?: string | null | Array<{ type?: string; text?: string }>
  reasoning?: string | null
  reasoning_content?: string | null
}

function extractText(msg: GatewayMessage | undefined): string | null {
  if (!msg) return null
  const c = msg.content
  if (typeof c === "string" && c.trim().length > 0) return c
  if (Array.isArray(c)) {
    const joined = c
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim()
    if (joined) return joined
  }
  // Last resort: some gateways only return reasoning with embedded JSON.
  for (const alt of [msg.reasoning_content, msg.reasoning]) {
    if (typeof alt === "string" && alt.includes("{") && alt.includes("}")) {
      const start = alt.indexOf("{")
      const end = alt.lastIndexOf("}")
      if (end > start) return alt.slice(start, end + 1)
    }
  }
  return null
}

async function once(
  messages: ChatMessage[],
  opts: { json?: boolean },
): Promise<{ ok: boolean; status: number; text: string | null; errBody?: string }> {
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const raw = await res.text()
    if (!res.ok) return { ok: false, status: res.status, text: null, errBody: raw.slice(0, 400) }

    const body = JSON.parse(raw) as {
      choices?: Array<{ message?: GatewayMessage; finish_reason?: string }>
    }
    const text = extractText(body.choices?.[0]?.message)
    return { ok: true, status: res.status, text }
  } catch (e) {
    console.error("[llm] complete failed:", e instanceof Error ? e.message : e)
    return { ok: false, status: 0, text: null }
  }
}

/** One chat completion. Returns the text, or null on any failure. */
export async function complete(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string | null> {
  if (!llmEnabled()) return null

  // Prefer JSON mode when requested; if the gateway rejects it, retry plain.
  if (opts?.json) {
    const first = await once(messages, { json: true })
    if (first.text) return first.text
    if (first.status === 400 || first.status === 422) {
      console.warn("[llm] json_object rejected — retrying without response_format")
      const second = await once(messages, { json: false })
      return second.text
    }
    if (!first.ok) console.warn("[llm] request failed", first.status, first.errBody)
    return null
  }

  const plain = await once(messages, { json: false })
  if (!plain.ok) console.warn("[llm] request failed", plain.status, plain.errBody)
  return plain.text
}
