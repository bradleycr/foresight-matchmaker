import { z } from "zod"
import { complete } from "./client"
import { extractJsonObject } from "./json"

/**
 * Remmy — conversational interviewer only.
 *
 * Best-practice split (2026 conversational intake):
 * - Remmy asks one question at a time and tracks what is still missing.
 * - Structured fields are extracted separately via proposeProfile() — never
 *   embedded in chat JSON, which reasoning models often fill in draft_summary
 *   but leave proposal empty.
 * - The UI shows a human review card before anything reaches the form.
 */

export type RemmyMode = "create" | "update"

export interface RemmyMessage {
  role: "user" | "assistant"
  content: string
}

/** Chat turn — no structured proposal; extraction is a separate step. */
export interface RemmyTurnResult {
  reply: string
  /** Remmy believes enough was shared to run the schema extractor. */
  ready_for_review: boolean
  draft_summary: string[]
}

const turnSchema = z.object({
  reply: z.string().min(1).max(4000),
  ready_for_review: z.boolean().catch(false),
  draft_summary: z
    .preprocess(
      (v) =>
        Array.isArray(v)
          ? v.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 240)).slice(0, 12)
          : [],
      z.array(z.string()),
    )
    .catch([]),
})

function systemPrompt(mode: RemmyMode, currentProfileJson: string | null): string {
  const role =
    mode === "create"
      ? "You are helping a new organisation create a directory profile."
      : "You are helping an organisation update their existing directory profile."

  return `You are Remmy, the Foresight Matchmaking guide. ${role}

Tone: clear, institutional, concise. No emojis. No hype.

Hard rules:
- NEVER claim a profile was saved or published. You only conduct the interview.
- NEVER invent contact details (name, email, role) or precise subject counts.
- Ask exactly ONE question at a time (TWO only if they are a natural pair, e.g. org name + HQ country). Never three.
- Keep replies to 1–3 short sentences plus the question(s).
- This platform lists organisations against open programmes. Recoding Medicine is the current programme — fields follow from that.
- If the user pastes an About page or long description (roughly 400+ characters), set ready_for_review=true immediately — ask no further questions; acknowledge and tell them to use "Fill form from chat".
- Set ready_for_review=true when you have: kind, organisation name, country, what they do, and what they are looking for (or equivalent for updates).
- draft_summary: bullets of what you understood AND what the human must still enter (especially contact email). Do NOT return structured profile fields — a separate extractor handles that.

Return ONLY JSON:
{
  "reply": "what Remmy says",
  "ready_for_review": true|false,
  "draft_summary": ["bullet", "..."]
}
${currentProfileJson ? `\nCurrent profile (update context):\n${currentProfileJson}` : ""}`
}

export async function remmyTurn(input: {
  mode: RemmyMode
  messages: RemmyMessage[]
  currentProfile?: Record<string, unknown> | null
}): Promise<RemmyTurnResult | null> {
  const history = input.messages
    .slice(-16)
    .map((m) => `${m.role === "user" ? "User" : "Remmy"}: ${m.content}`)
    .join("\n\n")

  const currentProfileJson = input.currentProfile
    ? JSON.stringify(stripForRemmyContext(input.currentProfile)).slice(0, 6000)
    : null

  const raw = await complete(
    [
      { role: "system", content: systemPrompt(input.mode, currentProfileJson) },
      { role: "user", content: `Conversation so far:\n\n${history}\n\nRespond as Remmy with the JSON object.` },
    ],
    { json: true },
  )
  if (!raw) return null

  try {
    return turnSchema.parse(JSON.parse(extractJsonObject(raw)))
  } catch {
    return null
  }
}

function stripForRemmyContext(profile: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...profile }
  delete clone.id
  delete clone.slug
  delete clone.eligible_hq
  delete clone.completeness
  delete clone.created_at
  delete clone.updated_at
  delete clone.contact_name
  delete clone.contact_email
  delete clone.contact_role
  delete clone.claimed_at
  return clone
}
