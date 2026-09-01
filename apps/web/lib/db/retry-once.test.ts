import { describe, expect, it, vi } from "vitest"
import { retryOnce } from "./retry-once"

describe("retryOnce", () => {
  it("returns the first success without calling onRetry", async () => {
    const onRetry = vi.fn()
    const value = await retryOnce(async () => 7, onRetry, 0)
    expect(value).toBe(7)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it("retries once after a failure and returns the second result", async () => {
    const onRetry = vi.fn()
    let calls = 0
    const value = await retryOnce(
      async () => {
        calls += 1
        if (calls === 1) throw new Error("fetch failed")
        return "ok"
      },
      onRetry,
      0,
    )
    expect(value).toBe("ok")
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onRetry.mock.calls[0]?.[0]).toBeInstanceOf(Error)
  })

  it("throws the second error when the retry also fails", async () => {
    const onRetry = vi.fn()
    await expect(
      retryOnce(
        async () => {
          throw new Error("still down")
        },
        onRetry,
        0,
      ),
    ).rejects.toThrow("still down")
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
