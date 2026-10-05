import { extractJsonObject } from "./json"

/**
 * YCluster OpenAI-compatible gateway. Same pattern as seks-kombi:
 * DeepSeek first, then LLM_MODEL_FALLBACKS when a backend is unhealthy.
 *
 * Availability is cached briefly so register/me can hide Remmy while the
 * cluster is down, without a chat completion on every page load.
 */

const TIMEOUT_MS = 60_000
/** Cheap /models probe — keep well under Hobby’s function budget. */
const PROBE_TIMEOUT_MS = 4_000
const AVAILABILITY_TTL_MS = 90_000
const MAX_TOKENS = 4096

/** Same defaults as seks-kombi, plus the Kimi id currently listed on YCluster. */
const DEFAULT_FALLBACKS =
  "glm-5.3-flash,nemotron-3-nano-omni,mlx-community/Kimi-K2.6-mlx-DQ3_K_M-q8"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

type GatewayMessage = {
  content?: string | null | Array<{ type?: string; text?: string }>
  reasoning?: string | null
  reasoning_content?: string | null
}

type OnceResult = {
  ok: boolean
  status: number
  text: string | null
  unhealthy?: boolean
  errBody?: string
}

type Availability = {
  ok: boolean
  checkedAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __rmmLlmAvailability: Availability | undefined
}

function baseUrl(): string {
  return (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")
}

export function llmEnabled(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL)
}

/** DeepSeek first (Remmy’s model), then whatever is healthy on the cluster. */
export function modelCandidates(): string[] {
  const primary = process.env.LLM_MODEL?.trim()
  const extras = (process.env.LLM_MODEL_FALLBACKS ?? DEFAULT_FALLBACKS)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  const preferred = ["deepseek-v4-flash", primary, ...extras].filter(Boolean) as string[]
  return [...new Set(preferred)]
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

function isUnhealthy(status: number, body: string): boolean {
  return status === 503 || status === 502 || /no healthy backend/i.test(body)
}

function readAvailability(): Availability | null {
  const cached = globalThis.__rmmLlmAvailability
  if (!cached) return null
  if (Date.now() - cached.checkedAt > AVAILABILITY_TTL_MS) return null
  return cached
}

function writeAvailability(ok: boolean): void {
  globalThis.__rmmLlmAvailability = { ok, checkedAt: Date.now() }
}

/** Force Remmy UI to show maintenance until the next probe window. */
export function markLlmUnavailable(): void {
  writeAvailability(false)
}

export function markLlmAvailable(): void {
  writeAvailability(true)
}

/**
 * Lightweight readiness: GET /models (not a chat completion). Cached ~90s
 * per isolate so a down cluster does not cost a full Remmy turn to discover.
 */
export async function llmReady(): Promise<boolean> {
  if (!llmEnabled()) return false

  const cached = readAvailability()
  if (cached) return cached.ok

  try {
    const res = await fetch(`${baseUrl()}/models`, {
      headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      const down = isUnhealthy(res.status, body) || res.status >= 500
      writeAvailability(!down)
      if (down) console.warn("[llm] gateway /models unhealthy", res.status, body.slice(0, 160))
      return !down
    }

    const json = (await res.json()) as { data?: Array<{ id?: string }> }
    const ids = new Set((json.data ?? []).map((row) => row.id).filter(Boolean) as string[])
    const anyCandidate = modelCandidates().some((id) => ids.has(id))
    // Empty/odd /models payloads still mean the gateway answered — try Remmy.
    writeAvailability(ids.size === 0 ? true : anyCandidate)
    return readAvailability()?.ok ?? true
  } catch (error) {
    console.warn("[llm] gateway probe failed", error instanceof Error ? error.message : error)
    writeAvailability(false)
    return false
  }
}

async function once(
  messages: ChatMessage[],
  model: string,
  opts: { json?: boolean; stream?: boolean },
): Promise<OnceResult & { response?: Response }> {
  try {
    const res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        ...(opts.stream ? { stream: true } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (opts.stream) {
      if (!res.ok || !res.body) {
        const raw = await res.text().catch(() => "")
        const unhealthy = isUnhealthy(res.status, raw)
        console.warn("[llm]", model, res.status, raw.slice(0, 180))
        return { ok: false, status: res.status, text: null, unhealthy, errBody: raw.slice(0, 400) }
      }
      return { ok: true, status: res.status, text: null, response: res }
    }

    const raw = await res.text()
    if (!res.ok) {
      const unhealthy = isUnhealthy(res.status, raw)
      console.warn("[llm]", model, res.status, raw.slice(0, 180))
      return { ok: false, status: res.status, text: null, unhealthy, errBody: raw.slice(0, 400) }
    }

    const body = JSON.parse(raw) as {
      choices?: Array<{ message?: GatewayMessage; finish_reason?: string }>
    }
    return { ok: true, status: res.status, text: extractText(body.choices?.[0]?.message) }
  } catch (e) {
    console.error("[llm] complete failed:", e instanceof Error ? e.message : e)
    return { ok: false, status: 0, text: null, unhealthy: true }
  }
}

async function* readStream(res: Response): AsyncGenerator<string> {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let carry = ""
  let reasoning = ""
  let yielded = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    carry += decoder.decode(value, { stream: true })
    const lines = carry.split("\n")
    carry = lines.pop() ?? ""
    let finished = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const payload = trimmed.slice(5).trim()
      if (payload === "[DONE]") {
        finished = true
        break
      }
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              content?: string | null
              reasoning?: string | null
              reasoning_content?: string | null
            }
          }>
        }
        const delta = json.choices?.[0]?.delta
        const piece = delta?.content
        if (typeof piece === "string" && piece) {
          yielded = true
          yield piece
        }
        const think = delta?.reasoning_content ?? delta?.reasoning
        if (typeof think === "string" && think) reasoning += think
      } catch {
        // ignore keepalives / partial JSON
      }
    }
    if (finished) break
  }
  if (!yielded && reasoning.includes("{")) {
    yield extractJsonObject(reasoning)
  }
}

/**
 * Stream an OpenAI-compatible completion. Tries each model candidate until
 * one accepts the stream. Yields nothing when every backend refuses.
 */
export async function* completeStream(
  messages: ChatMessage[],
  opts?: { json?: boolean },
): AsyncGenerator<string> {
  if (!llmEnabled()) return

  let sawAny = false
  for (const model of modelCandidates()) {
    const first = await once(messages, model, { json: opts?.json, stream: true })
    if (first.ok && first.response) {
      let emitted = false
      for await (const piece of readStream(first.response)) {
        emitted = true
        sawAny = true
        yield piece
      }
      if (emitted) {
        markLlmAvailable()
        return
      }
      // Stream opened but produced nothing — try next model.
      continue
    }

    if (opts?.json && (first.status === 400 || first.status === 422)) {
      const plain = await once(messages, model, { json: false, stream: true })
      if (plain.ok && plain.response) {
        let emitted = false
        for await (const piece of readStream(plain.response)) {
          emitted = true
          sawAny = true
          yield piece
        }
        if (emitted) {
          markLlmAvailable()
          return
        }
      }
    }
  }

  if (!sawAny) markLlmUnavailable()
}

/** One chat completion. Walks model fallbacks; returns null on total failure. */
export async function complete(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string | null> {
  if (!llmEnabled()) return null

  let anyUnhealthy = false
  for (const model of modelCandidates()) {
    if (opts?.json) {
      const first = await once(messages, model, { json: true })
      if (first.text) {
        markLlmAvailable()
        return first.text
      }
      if (first.status === 400 || first.status === 422) {
        console.warn("[llm] json_object rejected — retrying without response_format", model)
        const second = await once(messages, model, { json: false })
        if (second.text) {
          markLlmAvailable()
          return second.text
        }
        if (second.unhealthy) anyUnhealthy = true
      }
      if (first.unhealthy) {
        anyUnhealthy = true
        continue
      }
      if (!first.ok) continue
    } else {
      const plain = await once(messages, model, { json: false })
      if (plain.text) {
        markLlmAvailable()
        return plain.text
      }
      if (plain.unhealthy) {
        anyUnhealthy = true
        continue
      }
    }
  }

  if (anyUnhealthy) markLlmUnavailable()
  return null
}
