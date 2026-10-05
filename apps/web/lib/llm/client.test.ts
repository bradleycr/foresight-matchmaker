import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const original = {
  key: process.env.LLM_API_KEY,
  model: process.env.LLM_MODEL,
  base: process.env.LLM_BASE_URL,
  fallbacks: process.env.LLM_MODEL_FALLBACKS,
}

beforeEach(() => {
  process.env.LLM_API_KEY = "test-key"
  process.env.LLM_MODEL = "deepseek-v4-flash"
  process.env.LLM_BASE_URL = "https://example.test/v1"
  delete process.env.LLM_MODEL_FALLBACKS
  delete globalThis.__rmmLlmAvailability
})

afterEach(() => {
  if (original.key === undefined) delete process.env.LLM_API_KEY
  else process.env.LLM_API_KEY = original.key
  if (original.model === undefined) delete process.env.LLM_MODEL
  else process.env.LLM_MODEL = original.model
  if (original.base === undefined) delete process.env.LLM_BASE_URL
  else process.env.LLM_BASE_URL = original.base
  if (original.fallbacks === undefined) delete process.env.LLM_MODEL_FALLBACKS
  else process.env.LLM_MODEL_FALLBACKS = original.fallbacks
  delete globalThis.__rmmLlmAvailability
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe("modelCandidates", () => {
  it("puts DeepSeek first and includes default cluster fallbacks", async () => {
    const { modelCandidates } = await import("./client")
    const ids = modelCandidates()
    expect(ids[0]).toBe("deepseek-v4-flash")
    expect(ids).toContain("glm-5.3-flash")
    expect(ids).toContain("nemotron-3-nano-omni")
    expect(ids).toContain("mlx-community/Kimi-K2.6-mlx-DQ3_K_M-q8")
  })

  it("honours LLM_MODEL_FALLBACKS and dedupes the primary", async () => {
    process.env.LLM_MODEL_FALLBACKS = "glm-5.3-flash,custom-model"
    const { modelCandidates } = await import("./client")
    expect(modelCandidates()).toEqual(["deepseek-v4-flash", "glm-5.3-flash", "custom-model"])
  })
})

describe("complete fallbacks", () => {
  it("walks to the next model when DeepSeek has no healthy backend", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string }
      if (body.model === "deepseek-v4-flash") {
        return new Response("no healthy upstream", { status: 503 })
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: `ok:${body.model}` } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const { complete } = await import("./client")
    const text = await complete([{ role: "user", content: "hi" }])
    expect(text).toBe("ok:glm-5.3-flash")
    expect(fetchMock).toHaveBeenCalled()
  })
})

describe("llmReady", () => {
  it("returns false when /models is unhealthy and caches the miss", async () => {
    const fetchMock = vi.fn(async () => new Response("no healthy backend", { status: 503 }))
    vi.stubGlobal("fetch", fetchMock)

    const { llmReady } = await import("./client")
    expect(await llmReady()).toBe(false)
    expect(await llmReady()).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns true when a candidate model is listed", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ id: "deepseek-v4-flash" }, { id: "glm-5.3-flash" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { llmReady } = await import("./client")
    expect(await llmReady()).toBe(true)
  })
})
