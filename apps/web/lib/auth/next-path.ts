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
 * Every sign-in path confirms the mailbox. A new address still gets a
 * real link — claim then sends them to add a profile.
 */
export function needsEmailVerify(_path: string | null): boolean {
  return true
}

export function isRegisterPath(path: string | null): boolean {
  if (!path) return false
  return path === "/register" || path.startsWith("/register?")
}

export function isHerePath(path: string | null): boolean {
  if (!path) return false
  return /^\/here\/[a-z]+\/?$/.test(path)
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
