/** Incremental `"key": "…"` value from a partial JSON stream. */
export function extractPartialJsonString(buffer: string, key: string): string | null {
  const needle = `"${key}"`
  const keyAt = buffer.indexOf(needle)
  if (keyAt < 0) return null
  const colon = buffer.indexOf(":", keyAt + needle.length)
  if (colon < 0) return null
  const q = buffer.indexOf('"', colon + 1)
  if (q < 0) return null

  let out = ""
  for (let i = q + 1; i < buffer.length; i++) {
    const c = buffer[i]!
    if (c === "\\") {
      if (i + 1 >= buffer.length) break
      const n = buffer[i + 1]!
      out += n === "n" ? "\n" : n === "t" ? "\t" : n
      i += 1
      continue
    }
    if (c === '"') return out
    out += c
  }
  return out
}

/** Pull a JSON object out of an LLM response (plain, fenced, or embedded). */
export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) return trimmed
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}
