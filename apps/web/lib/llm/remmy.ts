import { z } from "zod"
import { complete } from "./client"
import { prefillProposalSchema, type PrefillProposal } from "./prefill"

/**
 * Remmy — the Matchmaker's conversational onboarding guide.
 *
 * Remmy never writes the database. Every turn may return a draft proposal;
 * the UI must show it for explicit human review before anything is applied
 * to the profile form. The form submit is still the only publish path.
 */

export type RemmyMode = "create" | "update"

export interface RemmyMessage {
  role: "user" | "assistant"
  content: string
}

export interface RemmyTurnResult {
  reply: string
  ready_for_review: boolean
  draft_summary: string[]
  proposal: PrefillProposal | null
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
  proposal: prefillProposalSchema.nullable().optional().catch(null),
})

function systemPrompt(mode: RemmyMode, currentProfileJson: string | null): string {
  const role =
    mode === "create"
      ? "You are helping a new organisation create a directory profile."
      : "You are helping an organisation update their existing directory profile. Only propose fields that should change."

  return `You are Remmy, the Recoding Medicine Matchmaker guide. ${role}

Tone: clear, institutional, concise — a capable directory attendant, not a chatbot personality. No emojis. No hype.

Hard rules:
- NEVER claim a profile was saved, published, or submitted. You only prepare drafts.
- NEVER invent contact details, subject counts, or ethics status. Ask when unsure.
- The human MUST review and confirm every draft before it is applied to the form.
- Prefer a short clarifying question over a weak draft. When you have enough signal, produce a draft.

Conversation goals (create):
1. Are they a data holder, AI team, or consortium?
2. Organisation name, country, one-liner, what they seek.
3. Enough structured detail for a useful directory listing (datasets OR AI capabilities / data needs).

Conversation goals (update):
1. What should change?
2. Produce a proposal containing ONLY fields to update.
3. Summarise each change plainly in draft_summary.

Return ONLY a JSON object with this shape:
{
  "reply": "what Remmy says to the user (markdown allowed, keep short)",
  "ready_for_review": true|false,
  "draft_summary": ["bullet of what you understood", "..."],
  "proposal": { ...profile fields... } | null
}

Set ready_for_review=true ONLY when proposal is non-null and substantial enough to review.
When ready_for_review is true, your reply MUST tell the user to use the on-screen review card (confirm / revise / discard) — do not claim the draft was applied.
Omit proposal (or null) while still clarifying.

Proposal field rules match the directory schema — use exact enum strings; omit anything uncertain.
${currentProfileJson ? `\nCurrent profile (JSON, for update context — do not echo private fields unnecessarily):\n${currentProfileJson}` : ""}`
}

/**
 * One Remmy turn. Returns null when the LLM is disabled or fails entirely.
 */
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
      {
        role: "user",
        content: `Conversation so far:\n\n${history}\n\nRespond as Remmy with the JSON object.`,
      },
    ],
    { json: true },
  )
  if (!raw) return null

  try {
    const parsed = turnSchema.parse(JSON.parse(raw))
    const proposal = parsed.proposal ?? null
    const ready = Boolean(parsed.ready_for_review && proposal)

    return {
      reply: parsed.reply,
      ready_for_review: ready,
      draft_summary: parsed.draft_summary,
      proposal: ready ? proposal : null,
    }
  } catch {
    return null
  }
}

/** Drop nothing sensitive into the model beyond what the owner already sees on /me. */
function stripForRemmyContext(profile: Record<string, unknown>): Record<string, unknown> {
  const clone = { ...profile }
  // Keep contact fields for update context — the owner is editing their own profile.
  delete clone.id
  delete clone.slug
  delete clone.eligible_hq
  delete clone.completeness
  delete clone.created_at
  delete clone.updated_at
  return clone
}
