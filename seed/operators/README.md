# Operator accounts

Real contact emails for people running demos and QA. Kept **out of**
`seed/golden/` so the synthetic test matrix stays fabricated (`.invalid` only).

Loaded by `pnpm db:seed` after golden fixtures, before bulk filler.

| Email | Slug | Purpose |
|---|---|---|
| `bradley@foresight.org` | `foresight-bradley` | Full-stack operator login (sign-in → /me → matches → intros) |
