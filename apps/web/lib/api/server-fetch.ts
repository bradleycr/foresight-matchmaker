import { headers } from "next/headers"

/**
 * Server components never import lib/db — every read goes through /api/v1,
 * same as any external client would. This helper self-fetches the app's own
 * API at request time, forwarding the caller's cookies so session-gated
 * routes behave identically.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const h = await headers()
  const host = h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"

  return fetch(`${proto}://${host}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      cookie: h.get("cookie") ?? "",
    },
  })
}
