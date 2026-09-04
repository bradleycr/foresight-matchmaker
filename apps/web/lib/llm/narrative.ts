import { z } from "zod"
import { complete } from "./client"
import { extractJsonObject } from "./json"

/**
 * Dedicated prose pass. Extraction maps enums; this writes the two
 * directory sentences the human actually reads.
 */

const BANNED = [
  "leading",
  "innovative",
  "cutting-edge",
  "cutting edge",
  "passionate",
  "at the forefront",
  "world-class",
  "world class",
  "state-of-the-art",
  "state of the art",
  "revolutionize",
  "revolutionise",
  "seamless",
  "leveraging",
  "game-changing",
  "next-generation",
  "next generation",
  "excited",
]

const narrativeSchema = z.object({
  one_liner: z.string().min(1).max(140),
  summary: z.string().min(1).max(600),
})

export type NarrativeDraft = z.infer<typeof narrativeSchema>

const SYSTEM = `You write two directory fields for a European health-data / AI matchmaking listing.

Tone: institutional, concrete, no marketing. No emojis.

one_liner (<=140): data or method, domain if they named one, scale if they named one, one distinguishing fact. Comma fragments. No "we are" / "we provide". No verb-first slogans.

summary (<=600): what it is; governance or access if they said so; what they want in a partner. Reuse their nouns. Never invent numbers, countries, disease areas, or ethics status.

Banned words: ${BANNED.join(", ")}.

Examples of good one_liners:
- Longitudinal MRI/CT oncology cohort with outcome linkage, 40k subjects.
- ECG waveforms + EHR for 90k cardiology patients, 11-year span.
- Federated learning for ICU time-series; TRE-only, no raw data movement.
- Independent clinical NLP, German + English notes, oncology-adjacent.

Examples of good summaries:
- A curated oncology imaging bank linking cross-sectional MRI and CT to registry outcomes and mortality. Governed under public-task provisions; available inside a secure processing environment only.
- Methods lab building privacy-preserving models for structured EHR. Can work in a TRE. Looking for a data-holding clinical partner.

Return ONLY JSON: { "one_liner": "...", "summary": "..." }`

function hasBanned(text: string): boolean {
  const lower = text.toLowerCase()
  return BANNED.some((w) => lower.includes(w))
}

/** Numbers the draft invented — digits that do not appear in the source. */
export function inventedNumbers(draft: string, source: string): string[] {
  const sourceNums = new Set(source.match(/\d+(?:[.,]\d+)*/g) ?? [])
  const draftNums = draft.match(/\d+(?:[.,]\d+)*/g) ?? []
  return draftNums.filter((n) => !sourceNums.has(n))
}

export function sanitizeNarrative(
  draft: Partial<NarrativeDraft>,
  source: string,
): NarrativeDraft | null {
  const one = (draft.one_liner ?? "").trim().replace(/\s+/g, " ").slice(0, 140)
  const sum = (draft.summary ?? "").trim().replace(/\s+/g, " ").slice(0, 600)
  if (one.length < 8 || sum.length < 20) return null
  if (hasBanned(one) || hasBanned(sum)) return null
  const combined = `${one} ${sum}`
  if (inventedNumbers(combined, source).length > 0) return null
  return { one_liner: one, summary: sum }
}

export async function composeNarrative(input: {
  sourceText: string
  facts?: Record<string, unknown> | null
}): Promise<NarrativeDraft | null> {
  const source = input.sourceText.trim()
  if (source.length < 20) return null

  const facts = input.facts ? `\n\nStructured facts (do not contradict):\n${JSON.stringify(input.facts).slice(0, 2500)}` : ""
  const user = `${source.slice(0, 6000)}${facts}\n\nWrite one_liner and summary. Reuse their words. Invent nothing.`

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      { json: true },
    )
    if (!raw) return null
    try {
      const parsed = narrativeSchema.parse(JSON.parse(extractJsonObject(raw)))
      const clean = sanitizeNarrative(parsed, `${source} ${JSON.stringify(input.facts ?? {})}`)
      if (clean) return clean
    } catch {
      // retry once
    }
  }
  return null
}
