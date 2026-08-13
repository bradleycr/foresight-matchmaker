# Privacy Notice — Foresight Matchmaking

_Last updated: 13 August 2026_

This notice applies to the **Foresight Matchmaking** directory and
matchmaking service. It is written for organisation contacts and data-protection
officers. It does **not** cover the Recoding Medicine programme application
process itself — that is handled by the programme host.

## Who operates this service

**Operator / controller for this directory:** Foresight Institute  
Website: https://foresight.org  
Privacy contact: see `PRIVACY_CONTACT_EMAIL` on the deployment (default contact
shown on `/privacy`).

Questions about Recoding Medicine eligibility, funding, or applications go to
the programme host inbox listed on `/privacy`, not to this directory’s privacy contact.

## What we collect

| Data | Purpose | Visibility |
| --- | --- | --- |
| Organisation profile (name, type, country, capabilities, dataset *descriptions*) | Members-only directory and deterministic matching | Visible to signed-in organisations, except fields marked private |
| One contact person (name, email, role) | Sign-in (magic link) and introductions | **Never public.** Revealed only after mutual acceptance of an introduction |
| Introduction messages and accept/decline | Double opt-in intro flow | Only the two organisations involved |
| Self-reported joint-application outcomes | Aggregate reporting on whether the matchmaker worked | Aggregated only |
| Technical event log (profile edits, intro state changes) | Security, abuse prevention, funnel metrics | Aggregated / internal |

We do **not** collect: passwords, payment data, precise location, advertising
identifiers, or any patient-level / health record data. Dataset entries describe
datasets; they are not the datasets themselves.

## Legal bases (GDPR)

- **Consent (Art. 6(1)(a))** — registering and maintaining a profile.
- **Legitimate interests (Art. 6(1)(f))** — running a secure, auditable
  matchmaking service for the challenge (security logs, rate limits, abuse
  prevention), balanced against your rights as an organisation contact.

You may withdraw consent by deleting your profile in **Your profile** (`/me`),
or by emailing the privacy contact below.

## What is visible to members

Directory listings are visible only to organisations that have created a profile
and signed in. Listings show organisation and capability information needed for
partner discovery. Contact details and private governance notes are never shown
on listings. When you send an introduction, we email both listed contacts so the
conversation continues off this platform. You can set visibility to hidden or
close introductions at any time.

## Recipients and processors

- **Hosting / application delivery** — this deployment may run on infrastructure
  such as Vercel. Request and security logs may be processed by that provider
  under their terms.
- **Email delivery** — if SMTP is configured, magic-link emails and introduction
  forwards are sent through the operator’s mail provider. Introductions copy the
  sender and set Reply-To so the thread continues in ordinary email.
- **Optional AI assistance (Remmy / paste pre-fill)** — only when you use those
  features; prompts are sent to the configured OpenAI-compatible inference
  gateway (e.g. YCluster) to draft profile fields. Drafts are never published
  without your confirmation. Matching scores are **not** produced by an LLM.

We do not sell personal data. We do not use third-party advertising or analytics
pixels.

## Cookies

Only strictly necessary cookies: signed session after sign-in, locale preference,
and an operator admin cookie when applicable. No non-essential cookies. No
consent banner is required for these alone under ePrivacy guidance for necessary
storage.

## Retention

- Profiles remain until you hide them, delete them in Your profile (`/me`), or
  request deletion by email.
- Profiles and introduction records are deleted **no later than 16 October 2027**
  (twelve months after the 16 October 2026 application deadline), unless you ask
  for earlier deletion.
- Magic-link tokens are single-use and expire after 24 hours.
- Aggregate metrics without personal data may be retained in reports.

## Your rights

Under the GDPR you may request access, rectification, erasure, restriction, or
portability, and you may object to processing based on legitimate interests.

**Self-service erasure:** signed-in users can permanently delete their own
profile from Your profile (`/me`). That removes the profile row, match-cache
entries in both directions, all introductions involving the profile, and
magic-link tokens bound to it; related event-log entries are anonymised.

**By email:** write to the privacy contact from your profile’s contact address
and name the organisation profile. We respond without undue delay (within one
month where required).

You may lodge a complaint with your supervisory authority (in Germany, the
[BfDI](https://www.bfdi.bund.de); see also the
[EDPB](https://edpb.europa.eu) member list).

## Children

This service is intended for organisation representatives. It is not directed at
children.
