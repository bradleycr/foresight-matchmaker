import { cookies } from "next/headers"
import { CHALLENGES, DEFAULT_CHALLENGE_ID, challengeIdOf, directoryHref } from "./catalog"
import type { ChallengeDef, ChallengeId } from "./catalog"
import { parseDemoUnlock, DEMO_COOKIE, type DemoUnlock } from "./demo-unlock"

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
 *   shared pitch link          signed `mm_demo` cookie (see demo-unlock.ts)
 *
 * Launching a programme for real is one word in the catalog — `preview` to
 * `open` — after which this module stops having an opinion about it.
 *
 * The flag is `NEXT_PUBLIC_` because the directory filters and the profile
 * form are client components and must agree with the server about which
 * programmes exist. Cookie unlocks are applied on the server and passed
 * down as props so the client never disagrees.
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

export function isChallengeVisible(id: ChallengeId, unlock: DemoUnlock | null = null): boolean {
  const challenge = CHALLENGES.find((c) => c.id === id)
  if (!challenge) return false
  if (unlock?.solo) return id === unlock.programme
  if (unlock && id === unlock.programme) return true
  return challenge.status === "open" || previewEnabled(id)
}

/** Every programme this visitor may browse, in catalog order. */
export function visibleChallenges(unlock: DemoUnlock | null = null): readonly ChallengeDef[] {
  return CHALLENGES.filter((c) => isChallengeVisible(c.id, unlock))
}

export function visibleChallengeIds(unlock: DemoUnlock | null = null): readonly ChallengeId[] {
  return visibleChallenges(unlock).map((c) => c.id)
}

/**
 * Resolve a programme id from untrusted input — a query string, a stored
 * listing — falling back to the default when it names a programme this
 * visitor cannot see.
 */
export function visibleChallengeIdOf(
  id: string | undefined | null,
  unlock: DemoUnlock | null = null,
): ChallengeId {
  const resolved = challengeIdOf(id)
  if (isChallengeVisible(resolved, unlock)) return resolved
  const visible = visibleChallenges(unlock)
  return visible[0]?.id ?? DEFAULT_CHALLENGE_ID
}

/**
 * Where Browse / Directory should land.
 *
 * Signed-in listers go to the programme on their listing. With a single
 * visible programme everyone else lands there too. Several visible
 * programmes and no listing yet → `/directory`, the chooser.
 */
export function browseDirectoryPath(
  listingChallengeId?: string | null,
  unlock: DemoUnlock | null = null,
): string {
  const visible = visibleChallenges(unlock)
  const listed = listingChallengeId
    ? visible.find((c) => c.id === listingChallengeId)
    : undefined
  if (listed) return directoryHref(listed.id)
  if (visible.length === 1) return directoryHref(visible[0]!.id)
  return "/directory"
}

/** Cookie unlock for this request, if any. */
export async function requestDemoUnlock(): Promise<DemoUnlock | null> {
  const jar = await cookies()
  return parseDemoUnlock(jar.get(DEMO_COOKIE)?.value)
}
