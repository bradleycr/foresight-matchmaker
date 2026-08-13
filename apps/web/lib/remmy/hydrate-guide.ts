import { toPublicProfile, type Profile } from "@rmm/schema"
import type { Factor, Blocker } from "@rmm/matching"
import { getShortlist } from "@/lib/db/matches"
import { getProfileById } from "@/lib/db/profiles"
import { templateRationale } from "@/lib/llm/rationale"
import { nudgeField } from "@/lib/match-nudge"
import type { GuideIntent } from "@/lib/llm/remmy-guide"
import type { DirectoryProfile } from "@/lib/api/types"

/** Exactly five slots in chat — people make the connections. */
export const GUIDE_SHORTLIST_LIMIT = 5

export interface GuideMatchCard {
  score: number
  factors: Factor[]
  blockers: Blocker[]
  rationale: string
  profile: DirectoryProfile
}

export type GuidePart =
  | { type: "match_shortlist"; matches: GuideMatchCard[] }
  | { type: "match_detail"; match: GuideMatchCard }
  | {
      type: "intro_compose"
      to_id: string
      to_name: string
      to_slug: string
      draft_message: string
    }
  | {
      type: "gaps"
      nudge_key: string
      completeness: number
      open_to_intros: boolean
      match_count: number
    }
  | { type: "navigate"; href: string; label_key: string }

function buildCard(subject: Profile, otherId: string, entry: ReturnType<typeof getShortlist>[number]): GuideMatchCard | null {
  const other = getProfileById(otherId)
  if (!other || other.visibility === "hidden") return null
  return {
    score: entry.score,
    factors: entry.factors,
    blockers: entry.blockers,
    rationale: templateRationale({
      subjectName: subject.org_name,
      otherName: other.org_name,
      score: entry.score,
      factors: entry.factors,
    }),
    profile: toPublicProfile(other) as unknown as DirectoryProfile,
  }
}

function shortlistCards(subject: Profile, limit = GUIDE_SHORTLIST_LIMIT): GuideMatchCard[] {
  const rows = getShortlist(subject.id).slice(0, limit)
  return rows.flatMap((entry) => {
    const card = buildCard(subject, entry.otherId, entry)
    return card ? [card] : []
  })
}

function resolveOther(
  subject: Profile,
  intent: { other_id?: string; org_hint?: string },
): GuideMatchCard | null {
  const cards = shortlistCards(subject, 10)
  if (intent.other_id) {
    const hit = cards.find((c) => c.profile.id === intent.other_id)
    if (hit) return hit
  }
  const hint = intent.org_hint?.trim().toLowerCase()
  if (hint) {
    const hit =
      cards.find((c) => c.profile.org_name.toLowerCase() === hint) ??
      cards.find((c) => c.profile.org_name.toLowerCase().includes(hint) || hint.includes(c.profile.org_name.toLowerCase()))
    if (hit) return hit
  }
  return cards[0] ?? null
}

function defaultIntroDraft(subject: Profile, other: DirectoryProfile): string {
  return `Hello — we are ${subject.org_name}. Your directory profile looks like a strong fit. We would like to explore a collaboration — reply to this email to continue.`
}

const NAV_LABELS: Record<string, string> = {
  "/me": "guide.nav_me",
  "/me/matches": "guide.nav_matches",
  "/me/inbox": "guide.nav_inbox",
  "/directory": "guide.nav_directory",
  "/register": "guide.nav_register",
}

/**
 * Turn untrusted model intents into curated, scorer-backed UI parts.
 * Unknown or unresolvable intents are dropped silently.
 */
export function hydrateGuideIntents(subject: Profile, intents: GuideIntent[]): GuidePart[] {
  const parts: GuidePart[] = []
  const seen = new Set<string>()

  for (const intent of intents) {
    if (intent.type === "show_matches") {
      if (seen.has("match_shortlist")) continue
      seen.add("match_shortlist")
      const matches = shortlistCards(subject)
      parts.push({ type: "match_shortlist", matches })
      if (matches.length === 0 && !seen.has("gaps")) {
        seen.add("gaps")
        parts.push({
          type: "gaps",
          nudge_key: nudgeField(subject),
          completeness: subject.completeness,
          open_to_intros: subject.open_to_intros,
          match_count: 0,
        })
      }
      continue
    }

    if (intent.type === "explain_match") {
      const match = resolveOther(subject, intent)
      if (!match || seen.has(`detail:${match.profile.id}`)) continue
      seen.add(`detail:${match.profile.id}`)
      parts.push({ type: "match_detail", match })
      continue
    }

    if (intent.type === "compose_intro") {
      const match = resolveOther(subject, intent)
      if (!match || seen.has(`intro:${match.profile.id}`)) continue
      if (!match.profile.open_to_intros) continue
      seen.add(`intro:${match.profile.id}`)
      const draft =
        intent.draft_message?.trim().slice(0, 500) || defaultIntroDraft(subject, match.profile)
      parts.push({
        type: "intro_compose",
        to_id: match.profile.id,
        to_name: match.profile.org_name,
        to_slug: match.profile.slug,
        draft_message: draft,
      })
      continue
    }

    if (intent.type === "show_gaps") {
      if (seen.has("gaps")) continue
      seen.add("gaps")
      parts.push({
        type: "gaps",
        nudge_key: nudgeField(subject),
        completeness: subject.completeness,
        open_to_intros: subject.open_to_intros,
        match_count: shortlistCards(subject).length,
      })
      continue
    }

    if (intent.type === "navigate") {
      const key = `nav:${intent.href}`
      if (seen.has(key)) continue
      seen.add(key)
      parts.push({
        type: "navigate",
        href: intent.href,
        label_key: NAV_LABELS[intent.href] ?? "guide.nav_directory",
      })
    }
  }

  return parts
}

/** Compact context the model may read — redacted, score-backed, no contacts. */
export function buildGuideContext(subject: Profile): Record<string, unknown> {
  const matches = shortlistCards(subject).map((m) => ({
    id: m.profile.id,
    org_name: m.profile.org_name,
    kind: m.profile.kind,
    country: m.profile.country,
    score: m.score,
    one_liner: m.profile.one_liner,
    soft_blockers: m.blockers.filter((b) => b.severity === "soft").map((b) => b.key),
    hard_blockers: m.blockers.filter((b) => b.severity === "hard").map((b) => b.key),
    open_to_intros: m.profile.open_to_intros,
  }))

  return {
    you: {
      org_name: subject.org_name,
      kind: subject.kind,
      country: subject.country,
      completeness: subject.completeness,
      open_to_intros: subject.open_to_intros,
      application_status: subject.application_status,
      looking_for: subject.looking_for,
      nudge_field: nudgeField(subject),
    },
    top_matches: matches,
    match_count: matches.length,
  }
}
