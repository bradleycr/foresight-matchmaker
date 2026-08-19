/**
 * True when the paste is a link (or a link plus a few stray words) rather
 * than the About-page prose the extractor needs. Fetching the URL is a
 * Thursday-out-of-scope failure mode; we ask for the text instead.
 */
export function pasteLooksLikeUrlOnly(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true

  const withoutUrls = trimmed.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim()
  const hasUrl = /https?:\/\/\S+/i.test(trimmed)
  return hasUrl && withoutUrls.length < 40
}
