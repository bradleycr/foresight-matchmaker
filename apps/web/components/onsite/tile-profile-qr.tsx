import { profilePageUrl } from "@/lib/onsite/profile-url"
import { qrSvgMarkup } from "@/lib/onsite/qr"

const SIZE: Record<"tile" | "pair" | "hero", string> = {
  tile: "h-8 w-8",
  pair: "h-10 w-10",
  hero: "h-12 w-12",
}

/**
 * Tiny profile QR for wall tiles. Scans open /profile/{slug} on the same
 * site — an existing session cookie skips sign-in; otherwise magic link
 * returns to this profile after one tap.
 */
export function TileProfileQr({
  origin,
  slug,
  tone,
  label,
}: {
  origin: string
  slug: string
  tone: "tile" | "pair" | "hero"
  label: string
}) {
  const url = profilePageUrl(origin, slug)
  const svg = qrSvgMarkup(url, { border: 1, ecc: "M" })

  return (
    <div
      className={`${SIZE[tone]} shrink-0 border border-ink bg-paper p-px text-ink`}
      role="img"
      aria-label={label}
      title={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
