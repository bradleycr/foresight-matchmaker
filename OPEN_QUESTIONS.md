# Open questions — speak to these on stage

Pulled from [`seed/golden/README.md`](seed/golden/README.md). Short answers you can give without inventing SPRIND policy.

---

## 1. Aurora Registry — `available_from: 2027-01-01` (golden #5)

**What the seed was designed to catch.** Aurora’s dataset only becomes available after Stage 1 start (Pitch Day, early November 2026). The original golden README asked whether the scorer should gain a weighted *factor* for this, which would reshuffle the 100-point weight table and invalidate the golden suite.

**What the code does today.** It is intentionally **not** a weighted factor. It is a **soft blocker** (`available_from_after_stage1` in `packages/matching/src/blockers.ts`): score is kept, the shortlist still ranks the pair, and both sides see a timeline warning. The golden test pins that behaviour.

**Why not a factor.** Availability is a planning risk, not a domain or access-model mismatch. Folding it into the weight table would punish otherwise strong pairs and force a deliberate re-tuning of every golden expectation. Soft-blocker + UI warning is enough for the demo and for applicants to resolve before applying.

**If SPRIND later wants a hard gate** (e.g. “data must be usable by Pitch Day”), that is a product decision — change the blocker severity or add a factor in its own commit with updated golden tests. Do not do it mid-demo.

---

## 2. Is `application_status` public or SPRIND-only?

**What the code does today.** Public. `application_status` is part of the redacted public profile shape (it is not in the private-field strip list). Anyone browsing the directory can see whether an organisation intends to apply, is undecided, already applying with a partner, has a complete team, or is not applying. The matcher also uses it: `not_applying` and `team_complete` are hard blockers (score zeroed).

**Trade-off to name out loud.** Public status helps matching (“who is still looking?”). It also reveals competitive intent; some applicants will refuse to state it, or will set `undecided` as cover.

**Ask SPRIND.** Whether they want this field visible on the public directory, visible only after sign-in, or visible only to SPRIND/admin. Until they say otherwise, leave it public — changing visibility is a redaction one-liner, not a schema redesign.

---

## 3. May one applicant appear on multiple applications?

**What the code does today.** A profile may hold **several intros in parallel** to different counterparties. The only exclusivity rule is per pair: you cannot have a second open (`requested` or `accepted`) intro with the *same* organisation (`duplicate_pending`). There is no “I have accepted one partner, freeze all other intros” state.

**Why that default.** The directory is a phone book for forming joint applications, not a binding engagement tool. Locking a profile to one accepted intro would require SPRIND to say that multi-application is disallowed — and would need new UI (decline-all, exclusivity badge) plus a state machine change.

**Ask SPRIND.** Whether one organisation may sit on more than one Stage 1 application. If **no**, add an exclusivity state after first accept (and surface it in the directory). If **yes**, keep the current parallel-intro model and say so when a reviewer asks.

---

## Related (already decided in code — not open)

| Topic | Status |
| --- | --- |
| `partner_only` (e.g. Meridian, US HQ) | Soft blocker; visible and matchable as collaborator, cannot lead. |
| Eligible HQ (CH, GB, IL, …) | Server-derived `eligible_hq`; golden profiles assert CH/GB/IL are eligible. |
| French-only discoverability (CHR Garonne) | French locale is fully translated; the profile remains a golden i18n case. |
| Private datasets (`publicly_describable: false`) | Stripped from every public payload; route-level redaction tests cover ISEA. |
