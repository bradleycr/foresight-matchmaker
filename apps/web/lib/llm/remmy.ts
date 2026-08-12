import { z } from "zod"
import { complete } from "./client"
import { prefillProposalSchema, proposeProfile, type PrefillProposal } from "./prefill"
import { proposalIsSubstantial } from "./example-about"

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
 * When forceDraft is set (or the user pasted a long About page), we also run
 * the dedicated profile extractor so the form actually gets filled — Remmy's
 * conversational JSON often puts facts in draft_summary but leaves proposal empty.
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

  const userBlob = input.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n")
    .trim()

  const forceDraft = Boolean(input.forceDraft)
  const longPaste = userBlob.length >= 400
  const needsExtraction = forceDraft || longPaste

  const currentProfileJson = input.currentProfile
    ? JSON.stringify(stripForRemmyContext(input.currentProfile)).slice(0, 6000)
    : null

  // Extract structured fields first when we know we need a form fill.
  const extracted = needsExtraction && userBlob.length >= 40 ? await proposeProfile(userBlob) : null

  const raw = await complete(
    [
      { role: "system", content: systemPrompt(input.mode, currentProfileJson, forceDraft || Boolean(extracted)) },
      {
        role: "user",
        content:
          forceDraft || extracted
            ? `Conversation so far:\n\n${history}\n\nFORCE DRAFT NOW. Respond as Remmy with the JSON object. The proposal MUST include org_name, country, one_liner, summary, and every other field supported by the chat — put facts in proposal, not only in draft_summary.`
            : `Conversation so far:\n\n${history}\n\nRespond as Remmy with the JSON object.`,
      },
    ],
    { json: true },
  )

  // Extraction alone is enough to proceed when the chat model fails.
  if (!raw && extracted && proposalIsSubstantial(extracted)) {
    return {
      reply:
        "I prepared a draft from what you shared. Use the review card to confirm it, then finish any highlighted fields (especially contact email) on the form.",
      ready_for_review: true,
      draft_summary: summaryFromProposal(extracted),
      proposal: extracted,
    }
  }
  if (!raw) return null

  try {
    const parsed = turnSchema.parse(JSON.parse(extractJsonObject(raw)))
    const fromChat = parsed.proposal ?? null
    const proposal = pickRicherProposal(fromChat, extracted)
    const ready = Boolean(
      proposal && (parsed.ready_for_review || forceDraft || proposalIsSubstantial(extracted)),
    )

    return {
      reply:
        ready && !parsed.reply.toLowerCase().includes("review")
          ? `${parsed.reply.trim()} Please use the on-screen review card to confirm before the form is filled.`
          : parsed.reply,
      ready_for_review: ready,
      draft_summary:
        parsed.draft_summary.length > 0 ? parsed.draft_summary : summaryFromProposal(proposal),
      proposal,
    }
  } catch {
    if (extracted && proposalIsSubstantial(extracted)) {
      return {
        reply:
          "I prepared a draft from what you shared. Use the review card to confirm it, then finish any highlighted fields on the form.",
        ready_for_review: true,
        draft_summary: summaryFromProposal(extracted),
        proposal: extracted,
      }
    }
    return null
  }
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) return trimmed
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return trimmed
}

function pickRicherProposal(
  a: PrefillProposal | null,
  b: PrefillProposal | null,
): PrefillProposal | null {
  if (!a) return b
  if (!b) return a
  const score = (p: PrefillProposal) =>
    [p.org_name, p.one_liner, p.summary, p.country, p.website].filter((x) => typeof x === "string" && x.trim()).length +
    (p.methods?.length ?? 0) +
    (p.looking_for?.length ?? 0) +
    (p.languages?.length ?? 0) +
    (p.privacy_capability?.length ?? 0) +
    (p.domain_expertise?.length ?? 0) +
    (p.application_target?.length ?? 0) +
    (p.data_needs?.modality?.length ?? 0) +
    (p.datasets?.length ?? 0)
  return score(b) > score(a) ? b : a
}

function summaryFromProposal(p: PrefillProposal | null): string[] {
  if (!p) return []
  const out: string[] = []
  if (p.kind) out.push(`Kind: ${p.kind}`)
  if (p.org_name) out.push(`Organisation: ${p.org_name}`)
  if (p.country) out.push(`Country: ${p.country}`)
  if (p.one_liner) out.push(p.one_liner)
  if (p.looking_for?.length) out.push(`Looking for: ${p.looking_for.join(", ")}`)
  if (p.methods?.length) out.push(`Methods: ${p.methods.join(", ")}`)
  out.push("Contact email must still be entered on the form.")
  return out
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
