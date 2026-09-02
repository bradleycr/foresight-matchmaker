/** Canonical profile URL for a room-board QR — same origin as the kiosk. */
export function profilePageUrl(origin: string, slug: string): string {
  const base = origin.replace(/\/$/, "")
  return `${base}/profile/${slug}`
}
