# Demo runbook — Vercel

This is the **Vercel** path — live at https://foresightmatchmaker.app. Docker/Hetzner is the simpler durable host (see `DEPLOY.md`) because SQLite lives on a disk volume; on Vercel the same `main` branch keeps listings in a private Blob store and uses `/tmp` SQLite as a cache.

Do not mix the two databases. Vercel SQLite is `/tmp` and wipes on deploy. A Hetzner volume is `./data` and must never be deleted. Blob is Vercel-only.

**Production URL:** https://foresightmatchmaker.app
**Vercel project:** `bradley-royes-projects/foresight-matchmaker` (`prj_kyy37fkdoAST7LzShqfkLFFJvNbm`)
The Vercel hostname `foresight-matchmaker.vercel.app` still serves the same deployment.

## Why Vercel's SQLite is safe to demo on, with one caveat

`DATABASE_PATH=/tmp/rmm-app.db` on Vercel is **ephemeral**: it survives across
requests served by the same warm serverless instance, but a cold start (new
deployment, or an instance recycled after inactivity) starts from an empty
`/tmp`. Production must **not** set `SEED_ON_EMPTY=true` — otherwise every
cold start refills ~118 fabricated profiles and looks like an applicant pool.

- Real registrations are dual-written to Vercel Blob (`BLOB_READ_WRITE_TOKEN`).
  The next instance refills SQLite from that store, so `/me` after create
  should not bounce to “we could not load your profile”.
- To empty a live Vercel instance that was seeded earlier: set
  `SEED_ON_EMPTY` to empty/false for Production, redeploy, and (if the
  instance is still warm) use `/admin` → Remove seed listings, or wait for
  the next cold start. Blob is not used for seed rows.

## Required environment variables (already set on Vercel)

Confirmed present for Development, Preview, and Production on the linked
project (`vercel env ls --scope bradley-royes-projects`):

| Variable | Value | Why |
| --- | --- | --- |
| `SESSION_SECRET` | random, generated | Required in production — the app now refuses to boot without it (see `instrumentation.ts`). |
| `ADMIN_SECRET` | `password123` | Unlocks `/admin`. The page also accepts `password123` even if this env value is rotated. |
| `RESEND_API_KEY` | set (Production) | **Primary** magic-link delivery from `hello@foresightmatchmaker.app`. `/signin` and `/register` show mode `email` when this is configured. |
| `SMTP_FROM` | `Foresight Matchmaking <hello@foresightmatchmaker.app>` | From address for Resend (and SMTP fallback). |
| `AUTH_REVEAL_LINKS` | `true` | **Fallback** when Resend/SMTP fails — link also returned in the JSON response and logged server-side. Keep on until you have confirmed inbox delivery in production. |
| `SEED_ON_EMPTY` | unset / `false` on Production | Must stay off on any host real applicants see. `true` only for a rehearsal deploy that should show fabricated listings. |
| `DATABASE_PATH` | `/tmp/rmm-app.db` | Vercel's only writable path for a function instance. Cache only — listings live in Blob. |
| `BLOB_READ_WRITE_TOKEN` | set (all envs) | Private Blob store `matchmaker-profiles`. Dual-write + hydrate so listings survive instance hops. |
| `APP_URL` | `https://foresightmatchmaker.app` | Canonical origin for Open Graph, robots, and magic links — so a hit on the `*.vercel.app` hostname still mints links on the owned domain. |
| `RATE_LIMIT_PER_24H` | `20` (recommended for the demo) | Outbound intro requests allowed per profile per rolling 24h. Defaults to 5, which a few rehearsal run-throughs from the same account will exhaust — set it higher for the demo so a live retry never trips `rate_limited` on stage. |

`/signin` and `/register` state which delivery mode is live (`magicLinkMode()` in
`lib/auth/mail.ts`): `email` when Resend/SMTP is configured, `reveal` when
`AUTH_REVEAL_LINKS` is the only path, or `log` otherwise.

## Cold-machine bring-up

From a clean checkout, to redeploy from scratch:

```bash
pnpm install
vercel login                       # if not already authenticated
vercel link --project foresight-matchmaker --scope bradley-royes-projects --yes
vercel env ls --scope bradley-royes-projects   # confirm the table above
vercel deploy --prod --scope bradley-royes-projects --yes
```

The build runs from the monorepo root via `apps/web/vercel.json`
(`installCommand`/`buildCommand` both `cd ../.. && pnpm ...`), and the
project's root directory is set to `apps/web` with output directory left on
Next.js's default — do not hand-set an output directory in the Vercel
dashboard, that previously broke the build (`.next` was looked up at a
doubled path).

## Smoke-test after every deploy

```bash
# Pages
curl -s -o /dev/null -w '%{http_code}\n' https://foresightmatchmaker.app/
curl -s -o /dev/null -w '%{http_code}\n' https://foresightmatchmaker.app/signin
curl -s -o /dev/null -w '%{http_code}\n' https://foresightmatchmaker.app/register
curl -s -o /dev/null -w '%{http_code}\n' https://foresightmatchmaker.app/directory

# API
curl -s https://foresightmatchmaker.app/api/v1/stats | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['by_challenge'])"
curl -s -o /dev/null -w '%{http_code}\n' https://foresightmatchmaker.app/api/v1/directory.json

# Signup gate: unknown email → welcome link (mode should be "email" when Resend is set)
curl -s -X POST https://foresightmatchmaker.app/api/v1/auth/request-link \
  -H 'content-type: application/json' \
  -d '{"email":"smoke-test@example.invalid","next":"/register"}' \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('ok'), d.get('mode'))"

# Unauthenticated listing create is rejected
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://foresightmatchmaker.app/api/v1/profiles \
  -H 'content-type: application/json' -d '{}'
```

Expect `200` on `/`, `/signin`, `/register`; `307`/`302` on `/directory` for unsigned visitors; programme counts from `/stats`; `401` on bare `POST /profiles`; request-link returns `True email` (or `True reveal` if mail is down).

**Full path (email → claim → create → delete → recreate):** with `RESEND_API_KEY` in your shell:

```bash
./scripts/e2e-prod.sh
```

Uses a throwaway `@foresight.org` address, reads the sent message from Resend, and cleans up after itself.

## Adding a listing live (verify-first)

1. Open **`/register`** — enter email, submit. Inbox receives a branded welcome email (Resend) with a one-time link to `/register`.
2. Click the link — session is verified with `profileId: null`; the listing form appears with contact email locked.
3. Submit the form — `POST /api/v1/profiles` publishes the listing and binds the session.
4. **Delete + re-add:** `/me` → delete listing → lands on `/register?deleted=1` still signed in; pick a new listing type without a second confirmation email.

Returning users with an existing listing use **`/signin`** (not `/register`).

## Resetting between rehearsals

`pnpm db:seed` alone is not a reset — it only upserts profiles, so intros,
events, and the match cache accumulate rehearsal junk. Two scripts fix this,
**but they run against a local SQLite file**, not Vercel's remote `/tmp`:

- `pnpm db:reset` — truncates profiles/matches/intros/auth_tokens/events,
  reseeds the 118 synthetic profiles, rebuilds the match cache. A pristine,
  empty-inbox state.
- `pnpm db:demo` — does the same reset, then pre-loads one **pending
  received** introduction and one already-**accepted** introduction into a
  known demo profile's inbox, so you can show the double opt-in flow
  (including the revealed contact block) without live-typing both sides.

On the actual Vercel deployment, the equivalent reset is to force a fresh
serverless instance:

```bash
vercel deploy --prod --scope bradley-royes-projects --yes
```

A new deployment gets a fresh `/tmp`. With `SEED_ON_EMPTY` unset, that
directory is empty — which is what production should show. A rehearsal
deploy that still needs the 118 fabricated profiles must set
`SEED_ON_EMPTY=true` **only on that environment**, then:

```bash
vercel deploy --prod --scope bradley-royes-projects --yes
```

Do not do that in the middle of a live session with real visitors. Local
`pnpm db:demo` still loads intros into `./data/app.db` for a laptop rehearsal.

## Signing in during the demo

**New listing:** walk through **`/register`** (verify-first). With Resend configured, the link arrives by email; if delivery fails, `AUTH_REVEAL_LINKS=true` also surfaces the link in the API response for controlled testing.

**Existing seed listing (local `pnpm db:demo` only):** `/signin` with a seed contact email. With `AUTH_REVEAL_LINKS=true` and no mail configured locally, the magic link appears on screen immediately — no inbox needed.

**Demo account** (after `pnpm db:demo`): `j.bakhuizen@example.invalid` —
Stichting Regionaal Pathologie Archief Zuid (`rpaz-zuid`). Signing in as this
profile and opening `/me/inbox` shows one pending received introduction (from
Elbe Vision Lab) and one already-accepted introduction with a revealed
contact block (from Fédération Neuro-IA, Lyon) — no live typing required to
demonstrate the double opt-in flow both ways.

Other known-good seed sign-in emails if you need a second party to
demonstrate *sending* a fresh request live:

- `a.voss@example.invalid` — Universitätsklinikum Nordharz
- `holder-a@example.invalid`

## Admin

1. Visit `/admin` and enter `password123`.

## If something looks wrong right before you go on

- **Blank page / 500** → check `vercel inspect <deployment-url> --logs`. As of P0.1, a missing `SESSION_SECRET` now fails at boot with a named error in the deploy log instead of a stack trace on first request — read the log, not the browser.
- **"You've been signed out" when you didn't sign out** → this is the exact bug P0.3 fixes (a 500 was rendering as a redirect to `/signin`). If you see it before that lands, it's a real server error — check the Vercel function logs, not your session.
- **Sign-in page doesn't show a link** → on production with Resend, links go to email (check spam). If mail failed, confirm `AUTH_REVEAL_LINKS=true` for Production (`vercel env ls`). Locally, reveal mode is on by default in development.
- **Magic link 404 / invalid** → links expire after 24h and are single-use. Request a fresh link. HMAC tokens must match `SESSION_SECRET` across instances (no sticky sessions required).
