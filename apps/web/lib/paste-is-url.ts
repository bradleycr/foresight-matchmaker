import { tryNormalizeUrl } from "./normalize-url"

/**
 * True when the paste is a link (or a link plus a few stray words) rather
 * than the About-page prose the extractor needs. Fetching the page is out
 * of scope; we save the URL onto Website and keep chatting.
 */
export function pasteLooksLikeUrlOnly(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true
  if (/^(www\.)?[a-z0-9][-a-z0-9.]*\.[a-z]{2,}(\/\S*)?$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return true
  }

  const withoutUrls = trimmed.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, " ").trim()
  const hasUrl = /https?:\/\/\S+/i.test(trimmed)
  return hasUrl && withoutUrls.length < 40
}

/** Normalize a URL-only paste for the Website field; null if it is not a link. */
export function websiteFromPaste(text: string): string | null {
  if (!pasteLooksLikeUrlOnly(text)) return null
  const trimmed = text.trim()
  const match = trimmed.match(/https?:\/\/\S+/i)
  return tryNormalizeUrl(match?.[0] ?? trimmed)
}
