import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))

vi.mock("@/lib/db/profiles", () => ({
  getProfileById: vi.fn(),
}))

const destroySession = vi.fn()
vi.mock("@/lib/auth/session", () => ({
  destroySession: (...args: unknown[]) => destroySession(...args),
  getSession: vi.fn(),
}))

const { redirectIfOwnListingGone, redirectToClearSession, CLEAR_SESSION_PATH } = await import("./live-session")

async function expectRedirect(run: () => Promise<unknown> | unknown, url: string): Promise<void> {
  try {
    await run()
    throw new Error("expected a redirect")
  } catch (error) {
    expect((error as Error).message).toBe(`REDIRECT:${url}`)
  }
}

describe("redirectIfOwnListingGone", () => {
  it("does not write cookies when the own listing is gone (401)", async () => {
    await expectRedirect(
      () => redirectIfOwnListingGone(new Response(null, { status: 401 })),
      CLEAR_SESSION_PATH,
    )
    expect(destroySession).not.toHaveBeenCalled()
  })

  it("bounces 404 through the logout route with stale=1", async () => {
    await expectRedirect(
      () => redirectIfOwnListingGone(new Response(null, { status: 404 })),
      `${CLEAR_SESSION_PATH}?stale=1`,
    )
    expect(destroySession).not.toHaveBeenCalled()
  })

  it("leaves successful responses alone", async () => {
    await redirectIfOwnListingGone(new Response(null, { status: 200 }))
    expect(destroySession).not.toHaveBeenCalled()
  })
})

describe("redirectToClearSession", () => {
  it("rejects API paths as next so logout cannot loop", async () => {
    await expectRedirect(
      () => redirectToClearSession({ next: "/api/v1/auth/logout" }),
      CLEAR_SESSION_PATH,
    )
  })

  it("keeps a same-origin page as next", async () => {
    await expectRedirect(
      () => redirectToClearSession({ next: "/register" }),
      `${CLEAR_SESSION_PATH}?next=%2Fregister`,
    )
  })
})
