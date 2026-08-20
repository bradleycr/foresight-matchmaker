/**
 * Canonical public origin. Magic links, Open Graph, and robots use this
 * when APP_URL is set; otherwise the owned production host.
 */
export const FALLBACK_PUBLIC_ORIGIN = "https://foresightmatchmaker.app"

export function publicOrigin(): string {
  const raw = process.env.APP_URL?.trim() || FALLBACK_PUBLIC_ORIGIN
  return raw.replace(/\/$/, "")
}
