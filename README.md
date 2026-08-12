# Recoding Medicine Matchmaker

A directory and matchmaking prototype that pairs **European health-data holders** with **AI/ML teams** so they can apply jointly to the [SPRIND Recoding Medicine challenge](https://www.sprind.org) (application deadline: **16 October 2026**).

Think of it as a phone book, not a social network: register a structured profile, browse the directory, get a deterministic ranked shortlist of counterparts, and request a **double opt-in introduction**. Contact details are revealed only after both sides agree.

> **All seed data is synthetic.** Every organisation, dataset, contact name, and email address under `seed/` is fabricated for demonstration purposes and does not describe any real institution. See `seed/README.md`.

---

## Quick start (no external services required)

```bash
pnpm install
pnpm db:seed      # load the synthetic directory + build the match cache
pnpm dev          # http://localhost:3000
```

That is the whole setup. Without SMTP configured, magic sign-in links are
shown on screen in development (and logged to the server console). In
production, set `SMTP_URL` — or explicitly `AUTH_REVEAL_LINKS=true` for a
controlled demo. Sign in with any seed contact email (e.g. `a.voss@example.invalid`).

To unlock `/admin`, set a secret first:

```bash
echo 'ADMIN_SECRET=demo-admin-secret' >> apps/web/.env
```

### Tests

```bash
pnpm test         # schema + matching + web integration suites (Vitest)
pnpm typecheck
```

## Deployment (Linux VM, Docker)

```bash
cp .env.example .env    # set SESSION_SECRET and ADMIN_SECRET
docker compose up -d --build
```

The SQLite database lives in `./data` on the host (bind-mounted to `/data`). On first boot with an empty database the container seeds the synthetic directory automatically (`SEED_ON_EMPTY=true`); an existing database is never touched. No US-hosted managed database is involved — the data stays on the VM.

Every environment variable is documented in [`.env.example`](.env.example).

## Repository layout

```
packages/schema      Zod schemas, enums, derived fields, JSON Schema export
packages/matching    Deterministic scoring: hard/soft blockers + weighted factors
apps/web             Next.js 15 App Router app (UI + /api/v1 + SQLite via Drizzle)
seed/                Synthetic demo profiles (fabricated data)
```

The UI is a pure client of the versioned API — everything the pages render comes from `/api/v1/*`.

## The schema, in one paragraph

A **profile** is a data holder, an AI team, or a consortium (both at once). Data holders describe one or more **datasets**: modality, disease area, subject/record scale, access model (export, secure processing environment, federated), ethics status, linkage, and annotation. AI teams describe **capabilities**: methods, domain expertise, compute, and — most importantly — `privacy_capability` (can they work inside a TRE, federate, or do they require data export?). The matcher scores pairs on disease and modality overlap, access-model compatibility, scale sufficiency, annotation/linkage fit, readiness, language, and colocation, and reports **hard blockers** (score zeroed, e.g. dataset cannot leave the institution and the team can only work on exported data) and **soft blockers** (score kept, friction surfaced) with every match.

The machine-readable contract:

- `GET /api/v1/schema/v1/profile.schema.json` — JSON Schema for the profile
- `GET /api/v1/directory.json` — the full redacted **public** directory (stable third-party contract)

## Public API (v1)

| Endpoint | Description |
| --- | --- |
| `GET /api/v1/directory.json` | Stable public machine contract: redacted `public` profiles only (no contact details, ever). What the footer links and third parties should call. |
| `GET /api/v1/directory` | UI corpus: same shape, but signed-in callers also receive `authenticated_only` profiles. Anonymous callers see `public` only. Pages self-fetch this; do not treat it as the public dump. |
| `GET /api/v1/schema/v1/profile.schema.json` | JSON Schema of the profile |
| `POST /api/v1/profiles` | Register a profile (returns a claim link) |
| `GET /api/v1/profiles/:id` · `PATCH` | Read public profile / edit own (session) |
| `GET /api/v1/matches` | Ranked shortlist for the signed-in profile |
| `GET /api/v1/intros` · `POST` · `PATCH /:id` | Double opt-in introduction flow |
| `POST /api/v1/auth/request-link` · `/claim` · `/logout` | Magic-link auth |
| `GET /api/v1/metrics` | Reporting (admin only; `?format=csv` for export) |

These two directory routes are intentional, not duplicates: `.json` is the lockable public dump; bare `/directory` is session-aware for the App Router pages.

Redaction is enforced server-side: `contact_name`, `contact_email`, `contact_role`, and hidden-field values never appear in any public payload. Contact details travel only inside an accepted introduction.

## Optional LLM features

Matching, search, and ranking are fully deterministic — no LLM is ever on an interactive path. Two optional conveniences light up when `LLM_API_KEY` and `LLM_MODEL` are set (any OpenAI-compatible endpoint via `LLM_BASE_URL`):

1. **Profile pre-fill** — paste a paragraph on the registration page and a draft profile is proposed for review. Never auto-published; with no LLM configured the box simply doesn't appear.
2. **Match rationale** — each match carries a two-sentence plain-language explanation. This is assembled deterministically from the factor breakdown, so it works identically with the LLM disabled.

The whole test suite passes with no LLM configured.

## Privacy

See [`PRIVACY.md`](PRIVACY.md). Highlights: minimal collection (one contact per organisation), no trackers, no analytics beyond an internal event log, data on the European deployment VM, and deletion on request once the controller is designated (`[CONTROLLER TBD]`).
