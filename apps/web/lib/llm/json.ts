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
