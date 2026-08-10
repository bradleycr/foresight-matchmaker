import { headers } from "next/headers"
import { redirect } from "next/navigation"

/**
 * Server components never import lib/db — every read goes through /api/v1,
 * same as any external client would. This helper self-fetches the app's own
 * API at request time, forwarding the caller's cookies so session-gated
 * routes behave identically.
 *
 * A timeout and a catch are load-bearing, not defensive boilerplate: without
 * them, a slow or dropped self-fetch becomes an unhandled promise rejection
 * that crashes the whole request instead of a page-level error state.
 */

const DEFAULT_TIMEOUT_MS = 8000

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const h = await headers()
  const host = h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"

  try {
    return await fetch(`${proto}://${host}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      headers: {
        ...(init?.headers ?? {}),
        cookie: h.get("cookie") ?? "",
      },
    })
  } catch (error) {
    // Network failure or timeout talking to our own API — surface it as an
    // ordinary failed response (caller's `!res.ok` branch handles it) rather
    // than letting it escape as an unhandled rejection.
    console.error(`[apiFetch] ${path} failed:`, error)
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })
  }
}

/**
 * Session-gated server components must redirect to /signin only on an
 * actual auth failure. Treating every non-2xx response as "you're signed
 * out" is the worst failure mode on stage: a transient 500 or a timeout
 * then looks indistinguishable from the user's session having expired.
 *
 * Call this first; it returns normally (does not redirect) on any other
 * status, including success, so the caller can go on to check `res.ok` and
 * throw for the nearest error.tsx boundary.
 */
export function redirectOnAuthFailure(res: Response): void {
  if (res.status === 401 || res.status === 403) redirect("/signin")
}
