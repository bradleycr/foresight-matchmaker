/**
 * The single LLM gateway (master prompt §8). Two callers exist — profile
 * pre-fill and match-rationale prose — and both are strictly optional:
 * every code path has a working no-LLM fallback and the whole test suite
 * passes with the LLM disabled.
 *
 * Points at any OpenAI-compatible endpoint (LLM_BASE_URL), so a self-hosted
 * European model (e.g. YCluster local-ai-proxy) works identically to a
 * commercial API. Hard timeout; any failure returns null rather than
 * throwing into the caller.
 *
 * Reasoning models (deepseek-v4-flash et al.) spend completion tokens on a
 * `reasoning` field before `content`. Cap max_tokens high enough that the
 * visible answer is not truncated to empty, and allow up to 30s for cold
 * cluster backends.
 */

const TIMEOUT_MS = 30_000
const MAX_TOKENS = 2048

export function llmEnabled(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL)
}

interface ChatMessage {
  role: "system" | "user"
  content: string
}

/** One chat completion. Returns the text, or null on any failure. */
export async function complete(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string | null> {
  if (!llmEnabled()) return null

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
        ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = body.choices?.[0]?.message?.content
    return typeof content === "string" && content.length > 0 ? content : null
  } catch {
    return null
  }
}
