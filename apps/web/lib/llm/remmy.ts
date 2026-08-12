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

function systemPrompt(mode: RemmyMode, currentProfileJson: string | null, forceDraft: boolean): string {
  const role =
    mode === "create"
      ? "You are helping a new organisation create a directory profile."
      : "You are helping an organisation update their existing directory profile. Only propose fields that should change."

  const forceBlock = forceDraft
    ? `
FORCE DRAFT NOW (user asked to fill the form from this chat):
- Set ready_for_review=true.
- Return the best proposal you can from the conversation so far.
- Ask ZERO questions in reply — one short sentence that the review card / form is ready.
- Fill every field you can support from the chat. Omit only what was never mentioned. Never invent contact email/name.
`
    : ""

  return `You are Remmy, the Recoding Medicine Matchmaker guide. ${role}

Tone: clear, institutional, concise — a capable directory attendant, not a chatbot personality. No emojis. No hype.

Hard rules:
- NEVER claim a profile was saved, published, or submitted. You only prepare drafts.
- NEVER invent contact details (name, email, role), subject counts, or ethics status. Ask when unsure — leave those for the human form.
- The human MUST review and confirm every draft before it is applied to the form.
- Question budget (strict): ask exactly ONE question per reply. You may ask TWO only when they are a natural pair that belongs in one short answer (e.g. “organisation name and HQ country?”). Never ask three. Never stack a list of unrelated questions. No “also… / and… / finally…” chains.
- Keep clarifying replies to 1–3 short sentences plus the question(s).
- The user may paste an organisation About page — treat that as rich input and move to a draft quickly (few or no follow-ups).
${forceBlock}
Conversation goals (create) — cover these topics one turn at a time (skip anything the paste already answered):
1. Kind: data holder, AI team, or consortium?
2. Organisation name (optionally pair with HQ country if still unknown).
3. HQ country, if not yet known.
4. One sentence on what they do / what data or capabilities they bring.
5. What they are looking for (dataset access, AI partner, clinical partner, …).
6. AI teams — next: methods OR disease area (one topic); later: TRE / federate / need export (one topic).
7. Data holders — next: modality OR access model; later: rough scale.
Then produce a draft. In draft_summary, list what you filled AND explicitly list what the human must still enter (especially contact email).

Conversation goals (update):
1. What should change? (one question)
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
When ready_for_review is true, your reply MUST tell the user to use the on-screen review card (confirm / revise / discard) — do not claim the draft was applied. Prefer a brief acknowledgement over more questions.
Omit proposal (or null) while still clarifying — unless FORCE DRAFT NOW is active.
Never put contact_email or contact_name in the proposal.

Proposal field rules match the directory schema — use exact enum strings; omit anything uncertain.
${currentProfileJson ? `\nCurrent profile (JSON, for update context — do not echo private fields unnecessarily):\n${currentProfileJson}` : ""}`
}

/**
 * One Remmy turn. Returns null when the LLM is disabled or fails entirely.
 * When forceDraft is set, Remmy must return a form-ready proposal from the chat so far.
 */
export async function remmyTurn(input: {
  mode: RemmyMode
  messages: RemmyMessage[]
  currentProfile?: Record<string, unknown> | null
  forceDraft?: boolean
}): Promise<RemmyTurnResult | null> {
  const history = input.messages
    .slice(-16)
    .map((m) => `${m.role === "user" ? "User" : "Remmy"}: ${m.content}`)
    .join("\n\n")

  const currentProfileJson = input.currentProfile
    ? JSON.stringify(stripForRemmyContext(input.currentProfile)).slice(0, 6000)
    : null

  const forceDraft = Boolean(input.forceDraft)
  const raw = await complete(
    [
      { role: "system", content: systemPrompt(input.mode, currentProfileJson, forceDraft) },
      {
        role: "user",
        content: forceDraft
          ? `Conversation so far:\n\n${history}\n\nFORCE DRAFT NOW. Respond as Remmy with the JSON object (ready_for_review=true, non-null proposal).`
          : `Conversation so far:\n\n${history}\n\nRespond as Remmy with the JSON object.`,
      },
    ],
    { json: true },
  )
  if (!raw) return null

  try {
    const parsed = turnSchema.parse(JSON.parse(raw))
    const proposal = parsed.proposal ?? null
    // Keep any proposal for the client even mid-chat; ready_for_review gates the review card.
    const ready = Boolean((parsed.ready_for_review || forceDraft) && proposal)

    return {
      reply: parsed.reply,
      ready_for_review: ready,
      draft_summary: parsed.draft_summary,
      proposal,
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
