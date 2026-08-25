import type { Profile } from "@rmm/schema"
import { listProfiles, getJointApplicationOutcome } from "./db/profiles"
import { getAllCachedMatches } from "./db/matches"
import { listAllIntros } from "./db/intros"
import { listEvents } from "./db/events"
import type { SignupSummary } from "./db/signups"

/**
 * The reporting engine behind programme admin pages and /api/v1/metrics.
 * SPRIND asked for this explicitly: the friction data — especially which
 * single field kills otherwise-strong matches — is the research output.
 */

export interface Metrics {
  generated_at: string
  challenge_id: string | null
  profiles: {
    total: number
    by_kind: Record<string, number>
    by_country: Record<string, number>
    by_org_type: Record<string, number>
    created_per_week: Record<string, number>
    median_completeness: number
    empty_field_counts: Record<string, number>
  }
  funnel: {
    signups: number
    signed_in: number
    unfinished: number
    unfinished_confirmed: number
    profiles: number
    profiles_with_shortlist_view: number
    intros_requested: number
    contact_email: number
    contact_linkedin: number
    intros_accepted: number
    intros_declined: number
    intros_expired: number
  }
  median_response_hours: number | null
  blocker_histogram: Record<string, number>
  decline_reasons: Record<string, number>
  joint_applications: Record<string, number>
}

function tally<T>(items: T[], key: (item: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    const k = key(item)
    if (k === null) continue
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** ISO week bucket ("2026-W33") for the created-over-time series. */
function isoWeek(iso: string): string {
  const d = new Date(iso)
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/** Fields that count as "empty" per profile — mirrors the completeness logic. */
const NUDGE_FIELDS = [
  "one_liner",
  "summary",
  "website",
  "languages",
  "looking_for",
  "attending",
  "methods",
  "privacy_capability",
  "track_record",
  "datasets",
] as const

function emptyFields(profile: Profile): string[] {
  const record = profile as unknown as Record<string, unknown>
  return NUDGE_FIELDS.filter((f) => {
    if (!(f in record)) return false
    const v = record[f]
    if (v === undefined || v === null) return true
    if (typeof v === "string") return v.trim().length === 0
    if (Array.isArray(v)) return v.length === 0
    return false
  })
}

function programmeOf(profile: Profile): string {
  return profile.challenge_id ?? "recoding_medicine"
}

export function computeMetrics(opts?: { challengeId?: string; signups?: SignupSummary }): Metrics {
  const challengeId = opts?.challengeId
  const allProfiles = listProfiles()
  const profiles = challengeId ? allProfiles.filter((p) => programmeOf(p) === challengeId) : allProfiles
  const ids = new Set(profiles.map((p) => p.id))
  const inProgramme = (id: string | null | undefined) => Boolean(id && ids.has(id))

  const intros = listAllIntros().filter((i) => !challengeId || inProgramme(i.fromId) || inProgramme(i.toId))
  const events = listEvents().filter((e) => {
    if (!challengeId) return true
    if (e.type === "intro_requested" || e.type === "intro_emailed") {
      return typeof e.payload.to === "string" && ids.has(e.payload.to)
    }
    return inProgramme(e.actorId)
  })
  const cached = getAllCachedMatches().filter((m) => !challengeId || (ids.has(m.subjectId) && ids.has(m.otherId)))

  // Which single blocker kills the most matches. Only hard blockers on
  // blocked pairs are counted; each pair is stored in both directions, so
  // halve at the end for a per-pair count.
  const blockerHistogram: Record<string, number> = {}
  for (const m of cached) {
    if (m.score > 0) continue
    for (const b of m.blockers) {
      if (b.severity !== "hard") continue
      // Blocker keys carry an "a."/"b." side label; the histogram cares about
      // the field, not the side, so fold both sides into one bucket.
      const key = b.key.replace(/^[ab]\./, "")
      blockerHistogram[key] = (blockerHistogram[key] ?? 0) + 1
    }
  }
  for (const k of Object.keys(blockerHistogram)) blockerHistogram[k] = Math.round(blockerHistogram[k] / 2)

  const emptyCounts: Record<string, number> = {}
  for (const p of profiles) {
    for (const f of emptyFields(p)) emptyCounts[f] = (emptyCounts[f] ?? 0) + 1
  }

  const responded = intros.filter((i) => i.respondedAt)
  const responseHours = responded.map(
    (i) => (new Date(i.respondedAt as string).getTime() - new Date(i.createdAt).getTime()) / 3_600_000,
  )

  const shortlistViewers = new Set(events.filter((e) => e.type === "shortlist_viewed").map((e) => e.actorId))

  // SPRIND report still reads “opened email or LinkedIn / requested intro”:
  // unique actor→target pairs from clicks (`intro_requested`), platform
  // emails (`intro_emailed`), and leftover intros-table rows. Same pair from
  // more than one source still counts once. Channel tallies stay click-only.
  const pairKey = (actorId: string | null, to: unknown) => `${actorId ?? "anon"}::${typeof to === "string" ? to : ""}`
  const introPairs = new Set<string>()
  for (const e of events) {
    if (e.type !== "intro_requested" && e.type !== "intro_emailed") continue
    introPairs.add(pairKey(e.actorId, e.payload.to))
  }
  for (const intro of intros) {
    introPairs.add(pairKey(intro.fromId, intro.toId))
  }
  const clickEvents = events.filter((e) => e.type === "intro_requested")
  const emailPairs = new Set(
    clickEvents.filter((e) => e.payload.channel === "email").map((e) => pairKey(e.actorId, e.payload.to)),
  )
  const linkedinPairs = new Set(
    clickEvents.filter((e) => e.payload.channel === "linkedin").map((e) => pairKey(e.actorId, e.payload.to)),
  )

  return {
    generated_at: new Date().toISOString(),
    challenge_id: challengeId ?? null,
    profiles: {
      total: profiles.length,
      by_kind: tally(profiles, (p) => p.kind),
      by_country: tally(profiles, (p) => p.country),
      by_org_type: tally(profiles, (p) => p.org_type),
      created_per_week: tally(profiles, (p) => isoWeek(p.created_at)),
      median_completeness: median(profiles.map((p) => p.completeness)) ?? 0,
      empty_field_counts: emptyCounts,
    },
    funnel: {
      signups: opts?.signups?.total ?? 0,
      signed_in: opts?.signups?.signed_in ?? 0,
      unfinished: opts?.signups?.unfinished ?? 0,
      unfinished_confirmed: opts?.signups?.confirmed ?? 0,
      profiles: profiles.length,
      profiles_with_shortlist_view: shortlistViewers.size,
      intros_requested: introPairs.size,
      contact_email: emailPairs.size,
      contact_linkedin: linkedinPairs.size,
      intros_accepted: intros.filter((i) => i.state === "accepted" || i.state === "emailed").length,
      intros_declined: intros.filter((i) => i.state === "declined").length,
      intros_expired: intros.filter((i) => i.state === "expired").length,
    },
    median_response_hours: median(responseHours),
    blocker_histogram: blockerHistogram,
    decline_reasons: tally(
      intros.filter((i) => i.state === "declined"),
      (i) => i.declineReason ?? "other",
    ),
    joint_applications: tally(profiles, (p) => getJointApplicationOutcome(p.id)),
  }
}

/** Flatten every metric into section,key,value rows — one CSV for everything. */
export function metricsToCsv(m: Metrics): string {
  const rows: string[][] = [["section", "key", "value"]]
  const push = (section: string, obj: Record<string, number | string | null>) => {
    for (const [k, v] of Object.entries(obj)) rows.push([section, k, String(v ?? "")])
  }

  rows.push(["meta", "generated_at", m.generated_at])
  rows.push(["meta", "challenge_id", m.challenge_id ?? ""])
  push("profiles_by_kind", m.profiles.by_kind)
  push("profiles_by_country", m.profiles.by_country)
  push("profiles_by_org_type", m.profiles.by_org_type)
  push("profiles_created_per_week", m.profiles.created_per_week)
  rows.push(["profiles", "total", String(m.profiles.total)])
  rows.push(["profiles", "median_completeness", String(m.profiles.median_completeness)])
  push("empty_field_counts", m.profiles.empty_field_counts)
  push("funnel", m.funnel)
  rows.push(["intros", "median_response_hours", String(m.median_response_hours ?? "")])
  push("blocker_histogram", m.blocker_histogram)
  push("decline_reasons", m.decline_reasons)
  push("joint_applications", m.joint_applications)

  return rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")
}
