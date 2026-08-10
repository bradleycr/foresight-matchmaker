# Seed data

**Every record in this directory is fabricated.**

There is **no real personal data** here. Organisation names, people, datasets,
websites, and email addresses are all invented for demonstration and testing.
All contact emails use the reserved `.invalid` TLD and can never route mail. Any
resemblance to a real organisation is coincidental.

## Layout

| Path | Role |
|---|---|
| `golden/` | Hand-authored test matrix (10 profiles). Source of truth for matcher assertions. |
| `data-holders.json` · `ai-teams.json` · `consortia.json` | Generated bulk directory filler (~27 profiles). |
| `golden/README.md` | What each golden profile is designed to catch. |

The loader (`pnpm db:seed`) upserts **golden first**, then bulk, skipping any
bulk slug that collides with a golden profile.

## Golden test matrix

These ten profiles are not here to look good. Roughly half exist to break
something. See `golden/README.md` for the full table. Highlights:

| Pair / profile | Assertion |
|---|---|
| UKN Nordharz ↔ Elbe Vision Lab | Perfect domain fit, **hard-blocked** by access model |
| CHR Garonne ↔ Fédération Neuro-IA | `federated_no_movement` scores **full** access-model marks |
| Aurora (`parallel_public_funding: unsure`) | Soft blocker with a resolution prompt |
| ISEA (CH) · Sentinel (GB) · Aleph (IL) | Switzerland, UK, and Israel are **eligible** |
| ISEA (`publicly_describable: false`) | Private dataset fields never leak publicly |
| ISEA (n&lt;1k) ↔ Aleph (needs 10k+) | High score with a graded scale penalty |
| Meridian (US, `partner_only`) | Visible and matchable as collaborator, not hard-blocked |

## How bulk is generated

```bash
pnpm --filter @rmm/schema exec tsx src/generate-seed.ts
pnpm seed:validate
pnpm db:seed
```

Every record is validated against the Zod `profileSchema`. `eligible_hq` and
`completeness` are derived server-side — never hand-set.
