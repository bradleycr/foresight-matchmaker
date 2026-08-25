# Foresight Matchmaking

A Foresight Institute directory that pairs organisations around open programmes. **Recoding Medicine** (application deadline **16 October 2026**) is the first programme on this instance.

Think of it as a phone book, not a social network: add a structured **listing** against a programme, browse the directory, get a deterministic ranked shortlist of counterparts, and **email an introduction**. Both contacts are on the thread so the conversation continues off this platform. Joint applications are filed with the programme host, not here.

**Production:** https://foresightmatchmaker.app. Smoke tests: [`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md). Operators: hosting and durable storage are in [`DEPLOY.md`](DEPLOY.md).

**Persistent host (when someone has time):** clone `main` onto a Linux VM with Docker. One-pager: [`DEPLOY.md`](DEPLOY.md).

> **All seed data is synthetic.** Every organisation, dataset, contact name, and email address under `seed/` is fabricated for demonstration purposes and does not describe any real institution. See `seed/README.md`.

---

## Adding a listing (verify-first)

1. **`/register`** — confirm your email (magic link via Resend when configured).
2. **Fill the form** (or chat with Remmy) — pick a **listing type**: data holder, AI team, consortium, or individual.
3. **Submit** — `POST /api/v1/profiles` requires a verified session; contact email is taken from the session, not the form.

One listing per email. To switch type, delete the listing under **Your listing** (`/me`) and submit a new one — you stay signed in; no second confirmation email.

Returning users: **`/signin`** with the email on their listing.

Magic links are **HMAC-signed in the URL** (no server-side token store required), so they work across Vercel serverless instances. Links are single-use and expire after 24 hours.

---

## Quick start (no external services required)

```bash
pnpm install
pnpm db:seed      # load the synthetic directory + build the match cache
pnpm dev          # http://localhost:3000
```

That is the whole setup. Without `RESEND_API_KEY` or `SMTP_URL`, magic links are
shown on screen in development (`AUTH_REVEAL_LINKS` defaults on locally). On
Vercel production, **Resend** sends real mail from `hello@foresightmatchmaker.app`;
`AUTH_REVEAL_LINKS=true` remains a fallback if delivery fails (link also logged).
Sign in with any seed contact email (e.g. `a.voss@example.invalid`), or walk through
**`/register`** to test verify-first signup.

To unlock `/admin`, open the page and enter `FSRM2026!`
(also accepted when `ADMIN_SECRET` is set to something else):

```bash
# optional — override the default
echo 'ADMIN_SECRET=your-real-secret' >> apps/web/.env
```

### Tests

```bash
pnpm test         # schema + matching + web integration suites (Vitest)
pnpm typecheck
```

## Deployment

Production is live at https://foresightmatchmaker.app. Push from `main` to deploy. Durable storage is documented in **[DEPLOY.md](DEPLOY.md)**.

**Linux VM** is the durable-disk path (same codebase). Follow **[DEPLOY.md](DEPLOY.md)**.

```bash
git clone https://github.com/bradleycr/foresight-matchmaker.git
cd foresight-matchmaker
cp .env.example .env    # SESSION_SECRET, ADMIN_SECRET, APP_URL; RESEND_* or SMTP_*
mkdir -p data
docker compose up -d --build
```

The SQLite database lives in `./data` on the host (bind-mounted to `/data`). An existing database is never touched. Leave `SEED_ON_EMPTY` unset so a fresh volume stays empty until real listings. For a local rehearsal only, set `SEED_ON_EMPTY=true` in `.env`.

Every environment variable is documented in [`.env.example`](.env.example).

## Repository layout

```
packages/schema      Zod schemas, enums, derived fields, JSON Schema export
packages/matching    Deterministic scoring: hard/soft blockers + weighted factors
apps/web             Next.js 16 App Router app (UI + /api/v1 + SQLite via Drizzle)
seed/                Synthetic demo profiles (fabricated data)
```

The UI is a pure client of the versioned API — everything the pages render comes from `/api/v1/*`.

## The schema, in one paragraph

A **listing** is one of four types: **data holder**, **AI team**, **consortium**, or **individual**. Data holders describe one or more **datasets**: modality, disease area, subject/record scale, access model (export, secure processing environment, federated), ethics status, linkage, and annotation. AI teams and individuals describe **capabilities**: methods, domain expertise, compute, and — most importantly — `privacy_capability` (can they work inside a TRE, federate, or do they require data export?). Consortia combine both and declare what they are **still seeking**. The matcher scores pairs on disease and modality overlap, access-model compatibility, scale sufficiency, annotation/linkage fit, readiness, language, and colocation, and reports **hard blockers** (score zeroed, e.g. dataset cannot leave the institution and the team can only work on exported data) and **soft blockers** (score kept, friction surfaced) with every match.

The machine-readable contract:

- `GET /api/v1/schema/v1/profile.schema.json` — JSON Schema for the profile
- `GET /api/v1/directory.json` — the full redacted **public** directory (stable third-party contract)

## Public API (v1)

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/directory.json` | Stable public machine contract: redacted `public` profiles only (no contact details, ever). What the footer links and third parties should call. |
| `GET /api/v1/directory` | UI corpus: same shape, but signed-in callers also receive `authenticated_only` profiles. Anonymous callers see `public` only. Pages self-fetch this; do not treat it as the public dump. |
| `GET /api/v1/schema/v1/profile.schema.json` | JSON Schema of the profile |
| `POST /api/v1/profiles` | Publish a listing (**session required** — email verified first on `/register`) |
| `GET /api/v1/profiles/:id` · `PATCH` · `DELETE` | Read / edit own listing / GDPR erase (delete keeps email verified for a fresh listing) |
| `GET /api/v1/matches` | Ranked shortlist for the signed-in profile |
| `GET /api/v1/intros` · `POST` · `PATCH /:id` | Double opt-in introduction flow |
| `POST /api/v1/auth/request-link` · `/claim` · `/logout` | Magic-link auth |
| `POST /api/v1/remmy` · `/remmy/guide` | Remmy interview (create/update) · signed-in match guide with generative UI parts |
| `GET /api/v1/metrics` | Reporting (admin only; `?format=csv` for export) |

These two directory routes are intentional, not duplicates: `.json` is the lockable public dump; bare `/directory` is session-aware for the App Router pages.

Redaction is enforced server-side: `contact_name`, `contact_email`, `contact_role`, and hidden-field values never appear in any public payload. Contact details travel only inside an accepted introduction.

## Optional LLM features

Matching, search, and ranking are fully deterministic — no LLM is ever on an interactive path. Two optional conveniences light up when `LLM_API_KEY` and `LLM_MODEL` are set (any OpenAI-compatible endpoint via `LLM_BASE_URL`):

1. **Remmy / profile pre-fill** — chat or paste on `/register`. Remmy fills the form (tappable chips for modality, disease area, methods). Nothing is published until submit. AI teams and individuals can skip “data I need”; data holders still need dataset modality and disease area. With no LLM configured the chat simply doesn't appear.
2. **Match rationale** — each match carries a two-sentence plain-language explanation. This is assembled deterministically from the factor breakdown, so it works identically with the LLM disabled.

The whole test suite passes with no LLM configured.

## Privacy

See [`PRIVACY.md`](PRIVACY.md). Highlights: Foresight Institute as operator of this directory, minimal collection (one contact per listing), no advertising trackers, optional AI drafting only with human confirmation, and deletion on request — self-service from **Your listing** (`/me`) or via the privacy contact email.
