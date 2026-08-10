# Demo runbook — Vercel

This is the demo path. Docker/VM is the durable long-term target for SPRIND
(see `README.md` → "Deployment (Linux VM, Docker)") but it is **not** what
tomorrow's demo runs on, and it has not been exercised end to end. Do not
deploy that path by accident: it needs a bind-mounted volume and a different
`DATABASE_PATH`, and mixing the two up is how you end up presenting the wrong
database.

**Production URL:** https://matchmaker-sprind.vercel.app
**Vercel project:** `bradley-royes-projects/matchmaker-sprind` (`prj_kyy37fkdoAST7LzShqfkLFFJvNbm`)

## Why Vercel's SQLite is safe to demo on, with one caveat

`DATABASE_PATH=/tmp/rmm-app.db` on Vercel is **ephemeral**: it survives across
requests served by the same warm serverless instance, but a cold start (new
deployment, or an instance recycled after inactivity) starts from an empty
`/tmp` and `SEED_ON_EMPTY=true` reseeds the 37 synthetic profiles
automatically. That means:

- Anything registered live on stage can disappear if the instance recycles
  mid-demo. Don't rely on state surviving between the morning rehearsal and
  the afternoon slot — re-verify right before you go on.
- This is also the mechanism for resetting between rehearsals (see below).
- It is **not** durable prod. If SPRIND asks to keep this running past the
  demo, that's the Docker/VM path with a bind-mounted volume, not this one.

## Required environment variables (already set on Vercel)

Confirmed present for Development, Preview, and Production on the linked
project (`vercel env ls --scope bradley-royes-projects`):

| Variable | Value | Why |
| --- | --- | --- |
| `SESSION_SECRET` | random, generated | Required in production — the app now refuses to boot without it (see `instrumentation.ts`). |
| `ADMIN_SECRET` | random, generated | Unlocks `/admin`. Retrieve with `vercel env pull .env.vercel.local --environment production` (gitignored — never commit it). |
| `AUTH_REVEAL_LINKS` | `true` | **Load-bearing.** With no SMTP configured, this is the only way anyone — including you, on stage — can sign in. Without it, magic links go to the server log only and `/signin` becomes unusable live. |
| `SEED_ON_EMPTY` | `true` | Auto-seeds the 37 synthetic profiles on a cold `/tmp`. |
| `DATABASE_PATH` | `/tmp/rmm-app.db` | Vercel's only writable path for a function instance. |

`/signin` already states which delivery mode is live (`lib/auth/mail.ts` →
`magicLinkMode()`), so if `AUTH_REVEAL_LINKS` were ever unset in production
the page would say "we've logged a link server-side" instead of silently
failing — but check the table above before you go on anyway.

## Cold-machine bring-up

From a clean checkout, to redeploy from scratch:

```bash
pnpm install
vercel login                       # if not already authenticated
vercel link --project matchmaker-sprind --scope bradley-royes-projects --yes
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
curl -s -o /dev/null -w '%{http_code}\n' https://matchmaker-sprind.vercel.app/
curl -s -o /dev/null -w '%{http_code}\n' https://matchmaker-sprind.vercel.app/signin
curl -s https://matchmaker-sprind.vercel.app/api/v1/directory.json | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d['profiles']),'profiles')"
```

Expect `200`, `200`, and `37 profiles` (or more once P1.3 regenerates the seed
— update this number then).

## Resetting between rehearsals

There is no remote "reset" button yet (that's `pnpm db:reset` / `db:demo`,
tracked as P0.2 — those scripts run against a **local** SQLite file; they do
not reach into Vercel's `/tmp`). Until a remote-safe reset endpoint exists,
the reliable way to clear rehearsal junk (test registrations, intros,
accepted/declined state) from the live deployment is to force a fresh
serverless instance:

```bash
vercel deploy --prod --scope bradley-royes-projects --yes
```

A new deployment gets a fresh `/tmp`, so `SEED_ON_EMPTY` reseeds the pristine
37-profile directory and every rehearsal artifact is gone. This takes
roughly 30–60 seconds; don't do it in the middle of a live demo, only
between rehearsal runs or right before you go on.

## Signing in during the demo

With `AUTH_REVEAL_LINKS=true`, `/signin` shows the magic link on screen
immediately after you submit a seed contact email — no email account needed.
Known-good seed sign-in emails:

- `a.voss@example.invalid`
- `j.bakhuizen@example.invalid`
- `holder-a@example.invalid`

(Once P0.2 lands, this section will instead point at the one scripted
`pnpm db:demo` account with a pending and an already-accepted intro
pre-loaded, so you don't have to live-type both sides of an introduction.)

## Admin

1. Retrieve the secret: `vercel env pull .env.vercel.local --environment production --scope bradley-royes-projects`, then read `ADMIN_SECRET` out of that file. Do not commit it; it's already gitignored (`.env*`).
2. Visit `/admin`, paste the secret.

## If something looks wrong right before you go on

- **Blank page / 500** → check `vercel inspect <deployment-url> --logs`. As of P0.1, a missing `SESSION_SECRET` now fails at boot with a named error in the deploy log instead of a stack trace on first request — read the log, not the browser.
- **"You've been signed out" when you didn't sign out** → this is the exact bug P0.3 fixes (a 500 was rendering as a redirect to `/signin`). If you see it before that lands, it's a real server error — check the Vercel function logs, not your session.
- **Sign-in page doesn't show a link** → check `AUTH_REVEAL_LINKS=true` is still set for Production specifically (`vercel env ls`), not just Preview/Development.
