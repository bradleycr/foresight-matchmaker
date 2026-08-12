/** Try to turn user or LLM text into a valid http(s) URL. Returns null when impossible. */
export function tryNormalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let candidate = trimmed
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.href
  } catch {
    return null
  }
}

/** Split a textarea into normalized URLs; report lines that could not be parsed. */
export function parseUrlLines(text: string, max = 5): { urls: string[]; invalidLines: string[] } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, max)

  const urls: string[] = []
  const invalidLines: string[] = []

  for (const line of lines) {
    const url = tryNormalizeUrl(line)
    if (url) urls.push(url)
    else invalidLines.push(line)
  }

  return { urls, invalidLines }
}
