import { toPublicProfile } from "@rmm/schema"
import { ok, unauthorized } from "@/lib/api/respond"
import { getProfileById, listProfiles } from "@/lib/db/profiles"
import { hydrateListings } from "@/lib/db/durable"
import { getShortlist } from "@/lib/db/matches"
import { resolveLiveSession } from "@/lib/auth/live-session"
import { logEvent } from "@/lib/db/events"
import { templateRationale } from "@/lib/llm/rationale"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/matches — the signed-in profile's ranked shortlist.
 *
 * Every pairing above the score-35 threshold, each entry carrying its full factor
 * breakdown and blocker list (soft blockers are displayed, never hidden),
 * with the counterpart embedded in redacted public form.
 *
 * Rationale prose is the deterministic template only — never an LLM call —
 * so this endpoint stays well under the 50ms interactive budget. Optional
 * LLM polish lives at POST /api/v1/matches/rationale.
 */
export async function GET(): Promise<Response> {
  await hydrateListings()
  const live = await resolveLiveSession()
  if (!live) return unauthorized()
  const { profile: subject } = live

  const shortlist = getShortlist(subject.id)
  logEvent("shortlist_viewed", subject.id, { count: shortlist.length })

  const othersVisible = listProfiles().filter((p) => p.id !== subject.id && p.visibility !== "hidden").length

  const matches = shortlist.flatMap((entry) => {
    const other = getProfileById(entry.otherId)
    if (!other || other.visibility === "hidden") return []
    return [
      {
        score: entry.score,
        factors: entry.factors,
        blockers: entry.blockers,
        computed_at: entry.computedAt,
        rationale: templateRationale({
          subjectName: subject.org_name,
          otherName: other.org_name,
          score: entry.score,
          factors: entry.factors,
        }),
        profile: toPublicProfile(other),
      },
    ]
  })

  return ok({ matches, others_visible: othersVisible })
}
