/**
 * Exact path match for masthead nav.
 *
 * `/me/matches` must not light “Your listing” (`/me`). Hash-only home links
 * (`/#programmes`) are never current.
 */
export function isActiveHref(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  const hashAt = href.indexOf("#")
  if (hashAt === 0 || (hashAt === 1 && href.startsWith("/#"))) return false
  const path = (hashAt >= 0 ? href.slice(0, hashAt) : href).split("?")[0] ?? href
  if (!path || path === "/") return pathname === "/"
  return pathname === path
}
