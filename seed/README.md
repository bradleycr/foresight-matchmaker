# Seed data

**Every record in this directory is fabricated.**

There is **no real personal data** here. Organisation names, people, datasets,
websites, and email addresses are all invented for demonstration and testing.
All contact emails use the reserved `.invalid` TLD and can never route mail. Any
resemblance to a real organisation is coincidental.

## Contents

| File | Count | Kind |
|---|---|---|
| `data-holders.json` | 12 | `data_holder` |
| `ai-teams.json` | 12 | `ai_team` |
| `consortia.json` | 3 | `consortium` |

## How it is generated

These files are produced deterministically by
`packages/schema/src/generate-seed.ts`. Every record is validated against the
Zod `profileSchema` at generation time, and `eligible_hq` / `completeness` are
computed by the same server-side derivation the app uses — never hand-set.

Regenerate:

```bash
pnpm --filter @rmm/schema exec tsx src/generate-seed.ts
```

Validate the checked-in files against the schema:

```bash
pnpm seed:validate
```

## Coverage

The set is deliberately varied so the matcher and the directory UI exercise
real edge cases:

- Access models spanning `open`/`registered`/`DUA`/`SPE-only`/`federated`.
- AI teams with `requires_data_export` paired against `data_can_leave: no`
  holders — the canonical hard-blocker scenario.
- Cross-imaging pairs (MRI vs CT vs histopath) for partial modality credit.
- `multi_domain` profiles for partial disease-area credit.
- One data holder with `publicly_describable: false` (hidden detail page).
- Consortia in three states: still-seeking, `team_complete`, and
  seeking-compute — to exercise the "excluded unless still_seeking" rule.
