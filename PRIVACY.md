# Privacy Notice — Foresight Matchmaking

_Last updated: 13 August 2026_

This notice applies to the **Foresight Matchmaking** directory and
matchmaking service, operated solely by **Foresight Institute**. It does
**not** cover Recoding Medicine applications. SPRIND is not a joint
controller of data processed on this directory.

## Who operates this service

**Operator / controller for this directory:** Foresight Institute  
Website: https://foresight.org  
Privacy contact: see `PRIVACY_CONTACT_EMAIL` on the deployment (default contact
shown on `/privacy`).

Recoding Medicine eligibility, funding, and applications are handled on the
official programme site. Using this directory does not constitute an
application to Recoding Medicine.

## What we collect

| Data | Purpose | Visibility |
| --- | --- | --- |
| Organisation profile (name, type, country, capabilities, dataset *descriptions*) | Directory listing and deterministic matching | Visible after sign-in, except fields marked private |
| One contact person (name, email, role); optional LinkedIn URL | Sign-in (magic link) and member-to-member contact | Email and LinkedIn are visible to **signed-in members** on the listing. Name and role are not. You can hide the email on your listing. |
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

Directory listings are visible only to people who have signed in. Listings show organisation and capability information needed for partner discovery, plus the contact email and LinkedIn URL when provided. Contact name, role, and private governance notes are never shown on listings. You can hide your email, hide your profile, or delete it at any time.

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
