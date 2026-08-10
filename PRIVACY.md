# Privacy Notice — Recoding Medicine Matchmaker

_Last updated: August 2026_

**Controller:** `[CONTROLLER TBD]` — placeholder. The legal controller for this
deployment has not been designated yet. Until it is, treat privacy requests as
open and contact the organisation operating this instance.

This service is a directory and matchmaking prototype that helps European health-data holders and AI/ML teams find each other to apply jointly to the SPRIND Recoding Medicine challenge. It is deliberately minimal: it is a phone book, not a platform.

## What we collect, and why

| Data | Purpose | Visibility |
| --- | --- | --- |
| Organisation profile (name, type, country, capabilities, dataset descriptions) | The public directory and matching | Public, except fields you mark private |
| One contact person per organisation (name, email, role) | Sign-in and introductions | **Never public.** Revealed only to a counterpart after both sides accept an introduction |
| Introduction requests and responses (message, accept/decline, optional decline reason) | Running the double opt-in intro flow | Visible only to the two organisations involved |
| Self-reported joint-application outcomes | Aggregate reporting to SPRIND on whether the matchmaker worked | Aggregated only |
| An internal event log (profile created, shortlist viewed, intro requested/answered) | Aggregate funnel metrics | Aggregated only |

We do **not** collect: passwords (sign-in is via one-time links), payment data, precise location, device fingerprints, or any patient-level or health data. Dataset entries are *descriptions* of datasets, not the data itself.

No cookies are set other than the strictly necessary ones: a session cookie after sign-in, a locale preference, and an admin cookie for the operator. There are no third-party trackers, no analytics scripts, and no advertising.

## Where the data lives

In a single SQLite database on the virtual machine this service is deployed to, hosted in Europe. No third-party managed database or US-hosted processor is involved. Sign-in emails are sent through the SMTP server configured by the operator, if any.

Seed data checked into the git repository is entirely synthetic (`.invalid` addresses). Real registrations live only in the deployment database.

## Retention

- Profiles remain published until you hide them (`visibility: hidden`) or request deletion.
- Profiles and introduction records are deleted **no later than 16 October 2027** (twelve months after the challenge application deadline of 16 October 2026), unless you ask for earlier deletion.
- Expired sign-in tokens are single-use and become invalid after 24 hours.
- Aggregate metrics (counts, histograms) contain no personal data and may be retained in reports.

## Your rights and how to request deletion

Under the GDPR you may request access, rectification, erasure, restriction, or portability of your data, and you may object to processing.

There is **no self-serve delete button** in this prototype. To exercise your rights:

1. Once the controller is designated, email them from your profile’s contact address and name the profile.
2. Until then, contact the organisation operating this deployment with the same details.

Deletion covers the profile row, its cached matches, its introduction records, and anonymisation of related event-log entries.

You also have the right to lodge a complaint with your supervisory authority.

## Legal basis

Processing is based on your consent (Art. 6(1)(a) GDPR), given when you register a profile, and on the legitimate interest (Art. 6(1)(f)) of running an efficient, auditable matchmaking process for the challenge. You may withdraw consent at any time by requesting deletion.
