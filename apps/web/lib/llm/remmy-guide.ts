import { z } from "zod"
import { complete } from "./client"
import { extractJsonObject } from "./json"

/**
 * Remmy Guide — logged-in matchmaker chat.
 *
 * The model never invents scores or contacts. It chooses *intents*; the
 * server hydrates curated React parts from the deterministic scorer and
 * directory. Humans still send introductions.
 */

export interface GuideMessage {
  role: "user" | "assistant"
  content: string
}

const intentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("show_matches") }),
  z.object({
    type: z.literal("explain_match"),
    other_id: z.string().optional(),
    org_hint: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal("compose_intro"),
    other_id: z.string().optional(),
    org_hint: z.string().max(200).optional(),
    draft_message: z.string().max(500).optional(),
  }),
  z.object({ type: z.literal("show_gaps") }),
  z.object({
    type: z.literal("navigate"),
    href: z.enum(["/me", "/me/matches", "/me/inbox", "/directory", "/register"]),
  }),
])

const turnSchema = z.object({
  reply: z.string().min(1).max(4000),
  intents: z.array(intentSchema).max(3).catch([]),
})

export type GuideIntent = z.infer<typeof intentSchema>
export type GuideTurnResult = z.infer<typeof turnSchema>

function systemPrompt(contextJson: string): string {
  return `You are Remmy, the Foresight Matchmaking guide for a signed-in organisation.

Tone: clear, institutional, concise. No emojis. No hype. Directory aesthetic.

You help them:
- understand and improve their matches,
- decide who to approach,
- draft an introduction email (never send — the human confirms; we then email both parties so they continue off-platform),
- fix profile gaps that hurt scoring.

The current open programme is Recoding Medicine (SPRIND). Joint applications happen on the challenge host site after an introduction — this directory never files them.

Hard rules:
- NEVER invent match scores, blockers, organisation names, or contact details.
- NEVER claim an introduction email was sent.
- NEVER claim the profile was saved.
- Prefer showing UI (intents) over long Markdown lists.
- Ask at most ONE clarifying question when needed.
- Keep reply to 1–4 short sentences.
- When they ask for matches / shortlist / who fits → intent show_matches.
- When they ask why someone matches, or about a named org → explain_match (use org_hint with the name they said; use other_id only if it appears in context).
- When they want to connect / introduce / reach out → compose_intro (draft a ≤500 char professional message in draft_message; never include emails).
- When matches are empty or they ask how to improve / get better matches → show_gaps (and optionally show_matches).
- When they want their profile, inbox, or directory → navigate.

Return ONLY JSON:
{
  "reply": "what Remmy says",
  "intents": [ /* 0–3 intents */ ]
}

Intent shapes:
{ "type": "show_matches" }
{ "type": "explain_match", "org_hint": "optional name", "other_id": "optional id from context" }
{ "type": "compose_intro", "org_hint": "optional", "other_id": "optional", "draft_message": "optional draft" }
{ "type": "show_gaps" }
{ "type": "navigate", "href": "/me" | "/me/matches" | "/me/inbox" | "/directory" | "/register" }

Signed-in context (trusted; do not contradict scores or names here):
${contextJson}`
}

export async function remmyGuideTurn(input: {
  messages: GuideMessage[]
  contextJson: string
}): Promise<GuideTurnResult | null> {
  const history = input.messages
    .slice(-16)
    .map((m) => `${m.role === "user" ? "User" : "Remmy"}: ${m.content}`)
    .join("\n\n")

  const raw = await complete(
    [
      { role: "system", content: systemPrompt(input.contextJson) },
      {
        role: "user",
        content: `Conversation so far:\n\n${history}\n\nRespond as Remmy with the JSON object. Prefer useful intents over empty ones when the user asked for matches, intros, or improvements.`,
      },
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
