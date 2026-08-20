import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))

const getProfileById = vi.fn()
const getProfilesByEmail = vi.fn()
vi.mock("@/lib/db/profiles", () => ({
  getProfileById: (...args: unknown[]) => getProfileById(...args),
  getProfilesByEmail: (...args: unknown[]) => getProfilesByEmail(...args),
}))

const createSession = vi.fn()
const destroySession = vi.fn()
const getSession = vi.fn()
vi.mock("@/lib/auth/session", () => ({
  createSession: (...args: unknown[]) => createSession(...args),
  destroySession: (...args: unknown[]) => destroySession(...args),
  getSession: (...args: unknown[]) => getSession(...args),
}))

const { peekLiveSession, redirectIfOwnListingGone, redirectToClearSession, CLEAR_SESSION_PATH } = await import("./live-session")

beforeEach(() => {
  createSession.mockReset()
  destroySession.mockReset()
  getProfileById.mockReset()
  getProfilesByEmail.mockReset()
  getSession.mockReset()
})

async function expectRedirect(run: () => Promise<unknown> | unknown, url: string): Promise<void> {
  try {
    await run()
    throw new Error("expected a redirect")
  } catch (error) {
    expect((error as Error).message).toBe(`REDIRECT:${url}`)
  }
}

describe("peekLiveSession", () => {
  it("recovers an owned profile by verified email when the cookie has no profile id", async () => {
    const profile = { id: "profile-1", contact_email: "owner@example.org" }
    getSession.mockResolvedValue({
      profileId: null,
      email: "owner@example.org",
      exp: Date.now() + 60_000,
    })
    getProfilesByEmail.mockReturnValue([profile])

    const live = await peekLiveSession()

    expect(live).toMatchObject({
      profile,
      session: { profileId: "profile-1", email: "owner@example.org" },
      needsReconcile: true,
    })
  })

  it("uses the profile id in a healthy session without reconciliation", async () => {
    const profile = { id: "profile-1", contact_email: "owner@example.org" }
    getSession.mockResolvedValue({
      profileId: "profile-1",
      email: "owner@example.org",
      exp: Date.now() + 60_000,
    })
    getProfileById.mockReturnValue(profile)

    const live = await peekLiveSession()

    expect(live).toMatchObject({ profile, needsReconcile: false })
    expect(getProfilesByEmail).not.toHaveBeenCalled()
  })

  it("returns null when the verified email owns no profile", async () => {
    getSession.mockResolvedValue({
      profileId: null,
      email: "new@example.org",
      exp: Date.now() + 60_000,
    })
    getProfilesByEmail.mockReturnValue([])

    await expect(peekLiveSession()).resolves.toBeNull()
  })
})

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
