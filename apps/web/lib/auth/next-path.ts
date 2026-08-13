/**
 * Return-to path after sign-in. Only same-origin relative paths — never
 * protocol-relative or off-site URLs.
 */
export function safeNextPath(raw: string | undefined | null): string | null {
  if (!raw) return null
  if (!raw.startsWith("/")) return null
  if (raw.startsWith("//") || raw.includes("://")) return null
  if (raw.startsWith("/signin") || raw.startsWith("/claim")) return null
  return raw.slice(0, 200)
}

export function signInHref(next?: string): string {
  const path = safeNextPath(next)
  return path ? `/signin?next=${encodeURIComponent(path)}` : "/signin"
}
