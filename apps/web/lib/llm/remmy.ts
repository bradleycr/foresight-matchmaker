import { z } from "zod"
import { complete, completeStream } from "./client"
import { extractJsonObject, extractPartialJsonString } from "./json"
import { formatGapsForRemmy, remmySprintGaps, type GapField } from "@/lib/profile-form-gaps"
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
  requiredText: string,
  optionalText: string,
  requiredDone: boolean,
): string {
  const role =
    mode === "create"
      ? "You are helping a new organisation create a directory listing. Sprint only what is required to publish. Optional matching fields come after, and only if they ask."
      : "You are helping an organisation update their existing directory profile."

  const formOpen = Boolean(currentProfileJson || requiredText || optionalText)

  return `You are Remmy, the Foresight Matchmaking guide. ${role}

Tone: clear, institutional, concise. No emojis. No hype.

Hard rules:
- NEVER claim a profile was saved or published. You only conduct the interview.
- NEVER invent contact details (name, email, role) or precise subject counts.
- Ask exactly ONE question at a time (TWO only if they are a natural pair, e.g. org name + HQ country). Never three.
- Keep replies to 1–3 short sentences plus the question(s).
- This platform lists organisations against open programmes. Recoding Medicine is the current programme — fields follow from that.
- If the user pastes an About page or long description (roughly 400+ characters), set ready_for_review=true immediately — ask no further questions; acknowledge that the form will fill from that text.
- Required to list: kind, organisation name, country, what they do (enough to draft a one-liner). Data holders also need a dataset name, modality, and disease area. Contact name and email are typed on the form — never ask for them in chat.
- Do NOT ask for website, languages, events, looking-for, methods, or a long summary until required fields are done. A separate writer drafts the one-liner and summary from what they already said.
- Set ready_for_review=true as soon as the required set above is covered.
${
  requiredDone
    ? `- Required fields are done. Congratulate in one short sentence. Set ready_for_review=true. Offer — do not continue asking — optional matching fields (looking-for, events, methods). If they decline or say they are done, stop.`
    : ""
}
${
  formOpen
    ? `- The form is already on screen. Do not re-ask fields that are already filled unless they want to change them.
- Ask about the most important REQUIRED open field next. Ignore optional fields until required is empty.
- Data holders / consortia: prefer dataset name, then modality, then disease area. Those ARE the profile.
- AI teams and independent experts: prefer what they do (methods if they volunteer them). Do NOT ask for a clinical disease area unless they already named one. Do NOT grill them on data modalities, cohort size, or annotation. "No specific disease area" and "Not sure yet" are complete answers.
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
- draft_summary: bullets of what you understood. Do NOT return structured profile fields — a separate extractor handles that.

Return ONLY JSON:
{
  "reply": "what Remmy says",
  "ready_for_review": true|false,
  "draft_summary": ["bullet", "..."],
  "ask": "kind" | "looking_for" | "languages" | "attending" | "methods" | "application_target" | "domain_expertise" | "privacy_capability" | "modality" | "disease_area" | null
}
${currentProfileJson ? `\nCurrent form (not yet published — do not claim it is saved):\n${currentProfileJson}` : ""}
${requiredText ? `\nRequired fields still empty — ask about these, one at a time:\n${requiredText}` : ""}
${optionalText ? `\nOptional (ask only after required is empty, and only if they want more):\n${optionalText}` : ""}`
}

export interface RemmyTurnInput {
  mode: RemmyMode
  messages: RemmyMessage[]
  currentProfile?: Record<string, unknown> | null
  openGaps?: string[] | null
  requiredGaps?: string[] | null
  optionalGaps?: string[] | null
  answeredAsks?: string[] | null
}

function promptMessages(input: RemmyTurnInput): [{ role: "system"; content: string }, { role: "user"; content: string }] {
  const answered = input.answeredAsks ?? []
  const required = gapsWithoutAnswered(input.requiredGaps ?? input.openGaps ?? [], answered)
  const optional = gapsWithoutAnswered(input.optionalGaps ?? [], answered)
  const sprint = remmySprintGaps(required as GapField[])
  const history = input.messages
    .slice(-16)
    .map((m) => `${m.role === "user" ? "User" : "Remmy"}: ${m.content}`)
    .join("\n\n")
  const currentProfileJson = input.currentProfile
    ? JSON.stringify(stripForRemmyContext(input.currentProfile)).slice(0, 6000)
    : null

  return [
    {
      role: "system",
      content: systemPrompt(
        input.mode,
        currentProfileJson,
        formatGapsForRemmy(sprint),
        formatGapsForRemmy(optional),
        sprint.length === 0 && input.mode === "create",
      ),
    },
    { role: "user", content: `Conversation so far:\n\n${history}\n\nRespond as Remmy with the JSON object.` },
  ]
}

function parseTurn(raw: string, input: RemmyTurnInput): RemmyTurnResult | null {
  try {
    const parsed = turnSchema.parse(JSON.parse(extractJsonObject(raw)))
    const profile = input.currentProfile ?? null
    const kind = typeof profile?.kind === "string" ? profile.kind : null
    const ask = resolveAsk(parsed.ask, {
      alreadyHasKind: Boolean(kind),
      answered: input.answeredAsks ?? [],
    })
    const required = gapsWithoutAnswered(input.requiredGaps ?? input.openGaps ?? [], input.answeredAsks ?? [])
    const forceReady =
      input.mode === "create" && remmySprintGaps(required as GapField[]).length === 0
    return {
      reply: parsed.reply,
      ready_for_review: forceReady || parsed.ready_for_review,
      draft_summary: parsed.draft_summary,
      ask,
    }
  } catch {
    return null
  }
}

export async function remmyTurn(input: RemmyTurnInput): Promise<RemmyTurnResult | null> {
  const raw = await complete(promptMessages(input), { json: true })
  if (!raw) return null
  return parseTurn(raw, input)
}

export async function* remmyTurnStream(
  input: RemmyTurnInput,
): AsyncGenerator<{ event: "delta" | "turn"; data: RemmyTurnResult | { reply: string } }> {
  const messages = promptMessages(input)
  let buffer = ""
  for await (const piece of completeStream(messages, { json: true })) {
    buffer += piece
    const reply = extractPartialJsonString(buffer, "reply")
    if (reply) yield { event: "delta", data: { reply } }
  }

  let parsed = buffer ? parseTurn(buffer, input) : null
  if (!parsed) {
    parsed = await remmyTurn(input)
  }
  if (parsed) yield { event: "turn", data: parsed }
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
