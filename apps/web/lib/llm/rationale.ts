import type { Factor } from "@rmm/matching"
import { complete, llmEnabled } from "./client"

/**
 * Match-rationale prose (master prompt §8.2).
 *
 * The score and ranking are never influenced by this. Template assembly is
 * the mandatory path; the LLM is an optional polish that may fail silently.
 */

export interface RationaleInput {
  subjectName: string
  otherName: string
  score: number
  factors: Factor[]
}

/** Deterministic two-sentence explanation from the factor breakdown. */
export function templateRationale(input: RationaleInput): string {
  const scored = input.factors
    .filter((f) => f.weight > 0)
    .map((f) => ({ ...f, ratio: f.earned / f.weight }))
    .sort((a, b) => b.ratio - a.ratio)

  if (scored.length < 2) {
    return `${input.otherName} scores ${input.score} against ${input.subjectName}.`
  }

  const best = scored[0]!
  const second = scored[1]!
  const worst = scored[scored.length - 1]!

  const label = (key: string) => key.replace(/_/g, " ")
  const strong = `Strongest on ${label(best.key)} and ${label(second.key)}.`

  if (worst.ratio >= 0.9) {
    return `${strong} No significant gaps across the scored factors.`
  }

  return `${strong} The main gap is ${label(worst.key)} (${Math.round(worst.earned)} of ${worst.weight} points).`
}

/**
 * Optional LLM polish. Returns null when disabled or on any failure —
 * callers keep the template string.
 */
export async function llmRationale(input: RationaleInput): Promise<string | null> {
  if (!llmEnabled()) return null

  const factorLines = input.factors
    .map((f) => `- ${f.key}: ${Math.round(f.earned)}/${f.weight} — ${f.note}`)
    .join("\n")

  const raw = await complete([
    {
      role: "system",
      content:
        "You write two short plain-language sentences explaining why two organisations are a good (or imperfect) match for a joint health-data / AI application. Do not invent facts. Do not mention scores as numbers unless given. No marketing tone. Institutional English.",
    },
    {
      role: "user",
      content: `Subject: ${input.subjectName}\nCounterpart: ${input.otherName}\nMatch score: ${input.score}/100\nFactor breakdown:\n${factorLines}\n\nWrite exactly two sentences.`,
    },
  ])

  if (!raw) return null
  const cleaned = raw.trim().replace(/^["']|["']$/g, "")
  // Guard against a runaway completion — two sentences, not an essay.
  if (cleaned.length < 40 || cleaned.length > 500) return null
  return cleaned
}

/** Template first; LLM polish when available. Always returns a string. */
export async function explainMatch(input: RationaleInput): Promise<string> {
  const fallback = templateRationale(input)
  const polished = await llmRationale(input)
  return polished ?? fallback
}
