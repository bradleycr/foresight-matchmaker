import { CHALLENGES, DEFAULT_CHALLENGE_ID, challengeIdOf, directoryHref } from "./catalog"
import type { ChallengeDef, ChallengeId } from "./catalog"

/**
 * Who may see an unlaunched programme.
 *
 * A programme marked `preview` in the catalog is finished enough to click
 * through but not announced. It shows up wherever previews are enabled and
 * is invisible — including by direct URL — everywhere else, so building the
 * next programme never disturbs the one currently taking applications.
 *
 * Previews are on when `NEXT_PUBLIC_PREVIEW_PROGRAMMES` says so, and
 * otherwise default to on outside production. So:
 *
 *   local dev, `pnpm dev`      previews on   (nothing to configure)
 *   production                 previews off  (nothing to configure)
 *   demo/preview deployment    set NEXT_PUBLIC_PREVIEW_PROGRAMMES
 *
 * Launching a programme for real is one word in the catalog — `preview` to
 * `open` — after which this module stops having an opinion about it.
 *
 * The flag is `NEXT_PUBLIC_` because the directory filters and the profile
 * form are client components and must agree with the server about which
 * programmes exist. That makes it a build-time value: on Vercel, changing it
 * takes a redeploy.
 */

const SETTING = (process.env.NEXT_PUBLIC_PREVIEW_PROGRAMMES ?? "").trim().toLowerCase()

const ALL_ON = new Set(["all", "1", "true", "on", "yes"])
const ALL_OFF = new Set(["none", "0", "false", "off", "no"])

/** Are previews of this specific programme enabled in this environment? */
function previewEnabled(id: ChallengeId): boolean {
  if (SETTING === "") return process.env.NODE_ENV !== "production"
  if (ALL_ON.has(SETTING)) return true
  if (ALL_OFF.has(SETTING)) return false
  return SETTING.split(",").some((entry) => entry.trim() === id)
}

export function isChallengeVisible(id: ChallengeId): boolean {
  const challenge = CHALLENGES.find((c) => c.id === id)
  if (!challenge) return false
  return challenge.status === "open" || previewEnabled(id)
}

/** Every programme this visitor may browse, in catalog order. */
export function visibleChallenges(): readonly ChallengeDef[] {
  return CHALLENGES.filter((c) => isChallengeVisible(c.id))
}

export function visibleChallengeIds(): readonly ChallengeId[] {
  return visibleChallenges().map((c) => c.id)
}

/**
 * Resolve a programme id from untrusted input — a query string, a stored
 * listing — falling back to the default when it names a programme this
 * visitor cannot see.
 */
export function visibleChallengeIdOf(id: string | undefined | null): ChallengeId {
  const resolved = challengeIdOf(id)
  return isChallengeVisible(resolved) ? resolved : DEFAULT_CHALLENGE_ID
}

/**
 * Where Browse / Directory should land.
 *
 * Signed-in listers go to the programme on their listing. With a single
 * visible programme everyone else lands there too. Several visible
 * programmes and no listing yet → `/directory`, the chooser.
 */
export function browseDirectoryPath(listingChallengeId?: string | null): string {
  const visible = visibleChallenges()
  const listed = listingChallengeId
    ? visible.find((c) => c.id === listingChallengeId)
    : undefined
  if (listed) return directoryHref(listed.id)
  if (visible.length === 1) return directoryHref(visible[0]!.id)
  return "/directory"
}
