import { z } from "zod"
import { complete } from "./client"
import { extractJsonObject } from "./json"
import { formatGapsForRemmy } from "@/lib/profile-form-gaps"
import { gapsWithoutAnswered, resolveAsk, type AskId } from "@/lib/remmy/ask"

/**
 * Remmy — conversational interviewer only.
 *
 * Chat collects facts; structured fields are extracted separately via
 * proposeProfile(). Vocabulary questions hydrate as tappable chips in the
 * UI (the model names the vocabulary, never the option list).
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
  /** Schema-hydrated chip group. Null when the question is free text. */
  ask: AskId | null
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
  ask: z.string().optional().catch(undefined),
})

function systemPrompt(
  mode: RemmyMode,
  currentProfileJson: string | null,
  openGapsText: string,
): string {
  const role =
    mode === "create"
      ? "You are helping a new organisation create a directory profile."
      : "You are helping an organisation update their existing directory profile."

  const formOpen = Boolean(currentProfileJson || openGapsText)

  return `You are Remmy, the Foresight Matchmaking guide. ${role}

Tone: clear, institutional, concise. No emojis. No hype.

Hard rules:
- NEVER claim a profile was saved or published. You only conduct the interview.
- NEVER invent contact details (name, email, role) or precise subject counts.
- Ask exactly ONE question at a time (TWO only if they are a natural pair, e.g. org name + HQ country). Never three.
- Keep replies to 1–3 short sentences plus the question(s).
- This platform lists organisations against open programmes. Recoding Medicine is the current programme — fields follow from that.
- If the user pastes an About page or long description (roughly 400+ characters), set ready_for_review=true immediately — ask no further questions; acknowledge that the form will fill from that text, and mention they can still chat to add more.
- Set ready_for_review=true when you have: kind, organisation name, country, what they do, and what they are looking for (or equivalent for updates). Contact email is typed on the form — never ask for it in chat.
${
  formOpen
    ? `- The form is already on screen. Do not re-ask fields that are already filled unless they want to change them.
- Ask about the most important OPEN field next.
- Data holders / consortia: prefer dataset name, then modality, then disease area. Those ARE the profile.
- AI teams and independent experts: prefer methods, application target, and privacy capability. Do NOT ask for a clinical disease area unless they already named one — many people here are methods, privacy, or infrastructure, not oncology/cardiology specialists. Do NOT grill them on data modalities, cohort size, or annotation unless they already said they know what data they need. "No specific disease area" and "Not sure yet" are complete answers.
- Vocabularies include Other. If they pick Other, or describe something not on the list, the chips capture "other" — then ask them to define it in a few words (free text, ask=null). Never invent that definition. Open fields looking_for_other, methods_other, or org_type_other mean they already chose Other: ask what they mean, then stop.
- Set ready_for_review=true when they have given NEW facts that should be merged into the form.`
    : ""
}
- When the question is a controlled vocabulary, set "ask" so the UI shows tappable chips. Do NOT list the options in the reply.
  ask values: kind, looking_for, languages, attending, methods, application_target, domain_expertise, privacy_capability, modality, disease_area.
  "ask" MUST name the same field as the question in "reply". If you ask which events they will attend, ask MUST be "attending". If you ask about languages, ask MUST be "languages". If you cannot set a matching ask, set ask to null. NEVER attach chips for a different field than the question.
  Use attending for Recoding Medicine events / remote-only.
  Use domain_expertise only if they already mentioned a clinical area they work in. Never lead with the 19 disease chips.
  Use modality / disease_area for a data holder's dataset.
  Use kind only if they have not said whether they are a data holder, AI team, consortium, or individual.
  Omit "ask" for free-text questions (name, country, what they do).
- draft_summary: bullets of what you understood AND what the human must still enter (especially contact email). Do NOT return structured profile fields — a separate extractor handles that.

Return ONLY JSON:
{
  "reply": "what Remmy says",
  "ready_for_review": true|false,
  "draft_summary": ["bullet", "..."],
  "ask": "kind" | "looking_for" | "languages" | "attending" | "methods" | "application_target" | "domain_expertise" | "privacy_capability" | "modality" | "disease_area" | null
}
${currentProfileJson ? `\nCurrent form (not yet published — do not claim it is saved):\n${currentProfileJson}` : ""}
${openGapsText ? `\nOpen fields still empty — ask about these, one at a time:\n${openGapsText}` : ""}`
}

export async function remmyTurn(input: {
  mode: RemmyMode
  messages: RemmyMessage[]
  currentProfile?: Record<string, unknown> | null
  openGaps?: string[] | null
  answeredAsks?: string[] | null
}): Promise<RemmyTurnResult | null> {
  const answered = input.answeredAsks ?? []
  const openGaps = gapsWithoutAnswered(input.openGaps ?? [], answered)
  const history = input.messages
    .slice(-16)
    .map((m) => `${m.role === "user" ? "User" : "Remmy"}: ${m.content}`)
    .join("\n\n")

  const currentProfileJson = input.currentProfile
    ? JSON.stringify(stripForRemmyContext(input.currentProfile)).slice(0, 6000)
    : null
  const openGapsText = formatGapsForRemmy(openGaps)

  const raw = await complete(
    [
      { role: "system", content: systemPrompt(input.mode, currentProfileJson, openGapsText) },
      { role: "user", content: `Conversation so far:\n\n${history}\n\nRespond as Remmy with the JSON object.` },
    ],
    { json: true },
  )
  if (!raw) return null

  try {
    const parsed = turnSchema.parse(JSON.parse(extractJsonObject(raw)))
    const profile = input.currentProfile ?? null
    const kind = typeof profile?.kind === "string" ? profile.kind : null
    const ask = resolveAsk(parsed.ask, {
      alreadyHasKind: Boolean(kind),
      answered,
    })
    return {
      reply: parsed.reply,
      ready_for_review: parsed.ready_for_review,
      draft_summary: parsed.draft_summary,
      ask,
    }
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
