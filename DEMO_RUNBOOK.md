# Demo runbook — Vercel

This is the demo path. Docker/VM is the durable long-term target for SPRIND
(see `README.md` → "Deployment (Linux VM, Docker)") but it is **not** what
tomorrow's demo runs on, and it has not been exercised end to end. Do not
deploy that path by accident: it needs a bind-mounted volume and a different
`DATABASE_PATH`, and mixing the two up is how you end up presenting the wrong
database.

**Production URL:** https://foresight-matchmaker.vercel.app
**Vercel project:** `bradley-royes-projects/foresight-matchmaker` (`prj_kyy37fkdoAST7LzShqfkLFFJvNbm`)
The previous hostname `matchmaker-sprind.vercel.app` forwards here.

## Why Vercel's SQLite is safe to demo on, with one caveat

`DATABASE_PATH=/tmp/rmm-app.db` on Vercel is **ephemeral**: it survives across
requests served by the same warm serverless instance, but a cold start (new
deployment, or an instance recycled after inactivity) starts from an empty
`/tmp`. Production must **not** set `SEED_ON_EMPTY=true` — otherwise every
cold start refills ~118 fabricated profiles and looks like an applicant pool.

- Real registrations on Vercel also disappear on cold start. That is why
  durable production is the Docker/VM path with a bind-mounted volume.
- To empty a live Vercel instance that was seeded earlier: set
  `SEED_ON_EMPTY` to empty/false for Production, redeploy, and (if the
  instance is still warm) use `/admin` → Remove seed listings, or wait for
  the next cold start.

## Required environment variables (already set on Vercel)

Confirmed present for Development, Preview, and Production on the linked
project (`vercel env ls --scope bradley-royes-projects`):

| Variable | Value | Why |
| --- | --- | --- |
| `SESSION_SECRET` | random, generated | Required in production — the app now refuses to boot without it (see `instrumentation.ts`). |
| `ADMIN_SECRET` | `password123` | Unlocks `/admin`. The page also accepts `password123` even if this env value is rotated. |
| `AUTH_REVEAL_LINKS` | `true` | **Load-bearing.** With no SMTP configured, this is the only way anyone — including you, on stage — can sign in. Without it, magic links go to the server log only and `/signin` becomes unusable live. |
| `SEED_ON_EMPTY` | unset / `false` on Production | Must stay off on any host real applicants see. `true` only for a rehearsal deploy that should show fabricated listings. |
| `DATABASE_PATH` | `/tmp/rmm-app.db` | Vercel's only writable path for a function instance. |
| `APP_URL` | `https://foresight-matchmaker.vercel.app` | Canonical origin for Open Graph, robots, and magic links — so a hit on the old forwarding hostname still mints links on the new one. |
| `RATE_LIMIT_PER_24H` | `20` (recommended for the demo) | Outbound intro requests allowed per profile per rolling 24h. Defaults to 5, which a few rehearsal run-throughs from the same account will exhaust — set it higher for the demo so a live retry never trips `rate_limited` on stage. |

`/signin` already states which delivery mode is live (`lib/auth/mail.ts` →
`magicLinkMode()`), so if `AUTH_REVEAL_LINKS` were ever unset in production
the page would say "we've logged a link server-side" instead of silently
failing — but check the table above before you go on anyway.

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
curl -s -o /dev/null -w '%{http_code}\n' https://foresight-matchmaker.vercel.app/
curl -s -o /dev/null -w '%{http_code}\n' https://foresight-matchmaker.vercel.app/signin
curl -s -o /dev/null -w '%{http_code}\n' https://foresight-matchmaker.vercel.app/directory
curl -s https://foresight-matchmaker.vercel.app/api/v1/stats | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['by_challenge'])"
curl -s -o /dev/null -w '%{http_code}\n' https://foresight-matchmaker.vercel.app/api/v1/directory.json
```

Expect `200`, `200`, `307`/`302` (directory redirects unsigned visitors to sign-in), programme counts, and `401` on the members-only directory API.

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

With `AUTH_REVEAL_LINKS=true`, `/signin` shows the magic link on screen
immediately after you submit a seed contact email — no email account needed.

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
- **Sign-in page doesn't show a link** → check `AUTH_REVEAL_LINKS=true` is still set for Production specifically (`vercel env ls`), not just Preview/Development.
