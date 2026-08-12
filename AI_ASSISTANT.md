# AI assistant — living plan

Status: **Remmy onboarding shipped** (create + update chat, mandatory draft review).
Directory Q&A / generative shortlist remain future work.

Related: [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md), [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md),
YCluster inference gateway ([docs](https://gitlab.com/devrandom01/ycluster/-/blob/main/docs/operations/inference.md)).

---

## Shipped: Remmy (profile create / update)

- `POST /api/v1/remmy` — conversational turn; **never writes the DB**.
- UI: `/register` chooser (Remmy vs form); `/me` optional “Update with Remmy”.
- Mandatory **draft review** card (confirm / revise / discard) before applying to `ProfileForm`.
- Form submit / Save remains the only publish path.
- Update mode requires a session; IP rate limit on the route.

Do not auto-publish from chat. Do not skip the review card.

## Goal

Make the matchmaker **AI-first in the UX** without making the LLM the source of
truth for ranking:

- Chat is the primary way to draft profiles, explore the directory, and get a
  shortlist.
- The deterministic scorer in `packages/matching` still produces scores,
  blockers, and the top‑5.
- Humans still send and accept introductions — AI never auto-connects.
- Generative UI: the assistant can open curated React surfaces (match cards,
  profile sheets, intro modals) inside the chat, not just dump Markdown.

Keep Recoding Medicine branding and schema as-is for this challenge. Design
seams so a second challenge (or non-SPRIND matchmaking) is config + content,
not a rewrite.

---

## Cluster wiring (Berlin / YCluster)

Inference goes through YCluster’s `local-ai-proxy` — one OpenAI-compatible
gateway in front of cluster backends. Keys are minted at
[dev1 API keys](https://dev1.ycluster.net/admin/settings/api-keys) (shown once;
revoke and recreate if lost).

| Env var | Value for this node |
| --- | --- |
| `LLM_BASE_URL` | `https://dev1.ycluster.net/v1` |
| `LLM_API_KEY` | `sk-…` gateway key (env only — never commit) |
| `LLM_MODEL` | `deepseek-v4-flash` |

Existing client: `apps/web/lib/llm/client.ts` already posts to
`${LLM_BASE_URL}/chat/completions` with `Authorization: Bearer …`. Prefill and
match-rationale light up as soon as these three are set. The future assistant
route should use the same trio (via AI SDK OpenAI-compatible provider).

**Ops notes from YCluster**

- Prefer the gateway for all backends; do not point Open-WebUI Connections at
  external providers (user identity headers can leak — see YCluster inference docs).
- Cluster-internal DNS (`http://inference.xc/v1`) is not reachable from Vercel;
  production must use the public `https://dev1.ycluster.net/v1` (or a later
  production domain).
- Rotate any key that was pasted into chat or shared outside the admin UI after
  testing.

Smoke test (local, key in shell only):

```bash
curl -s https://dev1.ycluster.net/v1/models \
  -H "Authorization: Bearer $LLM_API_KEY" | head

curl -s https://dev1.ycluster.net/v1/chat/completions \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"ping"}],"max_tokens":16}'
```

Then, with the three env vars in `apps/web/.env`, confirm `/register` shows the
prefill box and `/me/matches` can polish rationales.

---

## Architecture

```
Browser  →  Matchmaker (Vercel or local)
         →  POST /api/v1/assistant  (stream + tools)
         →  https://dev1.ycluster.net/v1/chat/completions
         →  deepseek-v4-flash on YCluster

Tools (server-only)  →  packages/matching + lib/db (redacted shapes only)
                     →  generative UI parts rendered by the client
```

| Layer | Owns |
| --- | --- |
| Deterministic matcher | Scores, hard/soft blockers, ordered shortlist |
| LLM assistant | Interview, explain, draft profile fields, *present* top‑5 |
| Human | Request / accept intros; edit profile before publish |

### Tools (Phase 1+)

| Tool | Behaviour |
| --- | --- |
| `get_my_matches` | Top **5** from scorer for signed-in profile |
| `explain_match` | Factor breakdown + rationale (existing path) |
| `search_directory` | Public redacted profiles |
| `propose_profile` | Prefill proposal (human must review) |
| `show_profile` | Emit generative UI: profile sheet |
| `show_match_shortlist` | Emit generative UI: five match cards |
| `start_intro` | Emit intro compose modal — **does not send** until confirm |
| `navigate` | Soft-nav to `/register`, `/me/matches`, etc. |

### Generative UI registry (curated — not arbitrary React)

- `MatchShortlist` — always five slots; show blockers honestly
- `ProfileSheet` / `ProfileCard`
- `MatchFactorBreakdown`
- `IntroComposeModal`
- `SignInPrompt`
- `RegisterDraftReview`

Chat messages = streamed text + typed UI parts. The model chooses *when*; the
app owns *how* (directory aesthetic: ink/paper, square corners).

---

## Multi-challenge / non-SPRIND (later, light)

Do **not** multi-tenant the DB before a second challenge is real. Prefer
**one deployment per challenge**.

Portable already: auth, directory, intros, admin metrics, redaction, LLM gateway.

Challenge-specific today: locales, schema enums, matching weights + golden
tests, seed, deadlines, partner marks.

Future seam (document only until needed):

```
challenge/
  id, name, branding, deadline, locales
  profile schema variant
  matching weights / blockers
  seed set
```

Spinning up another challenge = new config + seed + copy on the same engine.

---

## Phases

| Phase | Work | Touches `main` demo? |
| --- | --- | --- |
| **0** | This plan; wire `LLM_*` for prefill/rationale; rotate test keys | Env only |
| **1** | Branch: AI SDK chat + `get_my_matches` → five cards | No |
| **2** | Generative UI: profile sheet, intro modal, register draft | No until merge |
| **3** | Challenge config package (branding / copy overlay) | Additive |
| **4** | Second challenge deploy from config | Later |

Invariant for every phase: golden tests and route-level redaction tests stay green
with the LLM disabled.

---

## UX rules

- Surface **exactly five** recommendations; people make the connections.
- Always show *why* (top factors / soft blockers), not only a score.
- Never invent a match the scorer would hard-block.
- Cluster down → degrade to template shortlist (same as today’s no-LLM path).
- Mobile: bottom sheets; desktop: side panel / modal over the directory chrome.

---

## Explicit non-goals (for now)

- LLM on the scoring path
- Auto-send intros
- Multi-tenant single DB for many challenges
- Committing API keys or putting them in client bundles
