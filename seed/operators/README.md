# Operator accounts

Real contact emails for people running demos and QA. Kept **out of**
`seed/golden/` so the synthetic test matrix stays fabricated (`.invalid` only).

Loaded by `pnpm db:seed` after golden fixtures, before bulk filler. On a live
host, signing in as one of these emails also installs the listing if durable
storage never received it — so a cold isolate still lands on `/me` with a
shortlist instead of bouncing to `/register`.

| Email | Slug | Purpose |
|---|---|---|
| `bradley@foresight.org` | `foresight-bradley` | Data-holder demo login (sign-in → /me → ranked AI-team shortlist). Also unlocked via `/demo` with the shared event password (no magic link). |
