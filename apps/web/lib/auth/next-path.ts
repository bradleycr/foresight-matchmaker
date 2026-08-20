/**
 * Return-to path after sign-in. Only same-origin relative paths — never
 * protocol-relative or off-site URLs.
 */
export function safeNextPath(raw: string | undefined | null): string | null {
  if (!raw) return null
  if (!raw.startsWith("/")) return null
  if (raw.startsWith("//") || raw.includes("://")) return null
  if (raw.startsWith("/signin") || raw.startsWith("/claim")) return null
  if (raw.startsWith("/api")) return null
  return raw.slice(0, 200)
}

export function signInHref(next?: string): string {
  const path = safeNextPath(next)
  return path ? `/signin?next=${encodeURIComponent(path)}` : "/signin"
}

/** True when this return path is browsing a programme directory. */
export function isBrowsePath(path: string | null): boolean {
  if (!path) return false
  return path === "/directory" || path.startsWith("/directory?")
}

/**
 * Unknown emails on these paths still get a real confirmation link
 * (directory browse, add a listing). Bare /signin stays anti-enumeration.
 */
export function needsEmailVerify(path: string | null): boolean {
  return isRegisterPath(path) || isBrowsePath(path)
}

export function isRegisterPath(path: string | null): boolean {
  if (!path) return false
  return path === "/register" || path.startsWith("/register?")
}

/**
 * Where to send someone after they confirm a magic link.
 * Confirmed email, no listing yet → the form. Existing listing → /me
 * (unless they asked for another in-app page).
 */
export function afterClaimHref(profileId: string | null, next?: string | null): string {
  const dest = safeNextPath(next)
  if (profileId) {
    if (dest && !isRegisterPath(dest)) return dest
    return "/me"
  }
  return dest ?? "/register"
}
