# Seed data — read this before you use it

**Every organisation, person, dataset, email address and URL in these files is fabricated.** No entry describes, or is intended to describe, any real institution. All domains use `.invalid`, which is reserved by RFC 2606 and can never resolve. Do not replace these with real institution names for the demo.

The archetypes are realistic. The German entry reflects how Data Integration Centres at university hospitals actually operate under the Medical Informatics Initiative — FHIR-conformant core datasets and a nationwide Broad Consent as legal basis. The access-model values reflect the tiered reality of European health data, which runs from open download at one end to on-premises processing where data can be used but never viewed or exported at the other. That spectrum is the single most consequential axis in this whole product.

## This is a test matrix, not a demo dataset

These ten profiles are not here to look good. Roughly half exist to break something. If you build the matching engine and every pair produces a pleasing result, you have a bug, not a success.

| # | Profile | What it is designed to catch |
|---|---|---|
| 1 | UKN Nordharz ↔ Elbe Vision Lab | Perfect domain and modality fit, hard-blocked by access model. **The most important assertion in the suite.** |
| 2 | CHR Garonne ↔ Fédération Neuro-IA | `federated_no_movement` must score FULL marks against a federated-capable team, not be penalised as a restriction |
| 3 | CHR Garonne (French only) | i18n end-to-end: must be discoverable and legible to a German-speaking user |
| 4 | Aurora Registry (`parallel_public_funding: unsure`) | Soft blocker with a resolution prompt — not a hard block, not a silent rank drop |
| 5 | Aurora Registry (`available_from: 2027-01-01`) | Availability postdates Stage 1 start. Soft blocker only (not a weighted factor) — see root [`OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md). |
| 6 | ISEA Alpenraum (country CH) | Switzerland is EFTA and therefore **eligible** |
| 7 | Sentinel Health (country GB) | The UK is **eligible**. Getting this wrong hides much of Europe's best epidemiology talent. |
| 8 | Aleph Genomics (country IL) | Israel is **eligible**. Counter-intuitive, and in the rules. |
| 9 | ISEA (`publicly_describable: false`) | Assert by test that `n_subjects`, `volume` and `governance_notes` appear in **no** public API response and **no** rendered HTML |
| 10 | ISEA (n<1k) ↔ Aleph (needs 10k+) | Graded scale penalty: must yield a high score with a visible warning, not a low score |
| 11 | RPAZ Zuid | The star listing. Load-test the 5-intros-per-24h rate limit and the inbox against it. |
| 12 | Meridian Clinical AI | **Schema gap — fix before building the scorer.** See below. |

## Two schema bugs this exercise surfaced — both now fixed in the app

**`partner_only`.** Meridian is US-headquartered. SPRIND permits collaboration
partners outside the eligible HQ region — only the applicant HQ must be inside
it. The schema now carries an explicit `partner_only` boolean. Scorer rule:
`partner_only` profiles are **not** hard-blocked on `eligible_hq`; they stay
visible and matchable as collaborators, with a soft blocker noting they cannot
lead.

**Hebrew (and the rest of the eligible-region language set).** `he`, `fi`,
`pt`, `el`, `cs`, `hu`, and `ro` are in the `languages` enum.

## Fields still to confirm with SPRIND

Ask for these in the outreach email rather than guessing. Speaking notes and
current product defaults live in the root [`OPEN_QUESTIONS.md`](../../OPEN_QUESTIONS.md):

- Which of these fields SPRIND needs for its own eligibility pre-screening. If the profile schema already collects what the jury needs, the platform stops being a favour and becomes infrastructure.
- Whether they want `application_status` visible publicly or only to SPRIND. Public visibility helps matching; it also reveals competitive intent, and some applicants will refuse to state it.
- Whether an applicant may appear on more than one application. This determines whether a profile can accept multiple intros in parallel or whether the directory needs an exclusivity state.
