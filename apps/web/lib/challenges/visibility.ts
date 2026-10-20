import { cookies } from "next/headers"
import {
  CHALLENGES,
  DEFAULT_CHALLENGE_ID,
  acceptsNewListings,
  challengeIdOf,
  directoryHref,
} from "./catalog"
import type { ChallengeDef, ChallengeId } from "./catalog"
import { parseDemoUnlock, DEMO_COOKIE, type DemoUnlock } from "./demo-unlock"

/**
 * Who may see an unlaunched programme.
 *
 * A programme marked `preview` in the catalog is finished enough to click
 * through but not announced. It shows up wherever previews are enabled and
 * is invisible — including by direct URL — everywhere else, so building the
 * next programme never disturbs the live desk.
 *
 * Open and closed programmes are always public. Closed is an archive: browse
 * and edit existing listings, no new ones (`acceptsNewListings` is false).
 *
 * Previews are on when `NEXT_PUBLIC_PREVIEW_PROGRAMMES` says so, and
 * otherwise default to on outside production. So:
 *
 *   local dev, `pnpm dev`      previews on   (nothing to configure)
 *   production                 previews off  (nothing to configure)
 *   demo/preview deployment    set NEXT_PUBLIC_PREVIEW_PROGRAMMES
 *
 * A signed `mm_demo` cookie can focus a pitch deploy (solo / also), but it
 * never reveals a preview programme when previews are off — production stays
 * clean even if someone still has an old unlock cookie. Solo hide of archives
 * only applies while previews are actually enabled.
 *
 * The flag is `NEXT_PUBLIC_` because the directory filters and the profile
 * form are client components and must agree with the server about which
 * programmes exist. Cookie unlocks are applied on the server and passed
 * down as props so the client never disagrees.
 */

const ALL_ON = new Set(["all", "1", "true", "on", "yes"])
const ALL_OFF = new Set(["none", "0", "false", "off", "no"])

function previewSetting(): string {
  return (process.env.NEXT_PUBLIC_PREVIEW_PROGRAMMES ?? "").trim().toLowerCase()
}

/** Are previews of this specific programme enabled in this environment? */
export function previewEnabled(id: ChallengeId): boolean {
  const setting = previewSetting()
  if (setting === "") return process.env.NODE_ENV !== "production"
  if (ALL_ON.has(setting)) return true
  if (ALL_OFF.has(setting)) return false
  return setting.split(",").some((entry) => entry.trim() === id)
}

/** True when this environment may show any preview programme at all. */
export function previewsActive(): boolean {
  const setting = previewSetting()
  if (setting === "") return process.env.NODE_ENV !== "production"
  if (ALL_OFF.has(setting)) return false
  if (ALL_ON.has(setting)) return true
  return setting.split(",").some((entry) => entry.trim().length > 0)
}

/**
 * Unlock cookies only matter on desks where previews are turned on.
 * Production (previews off) ignores them so a leftover pitch cookie cannot
 * surface AI Safety Berlin or hide Recoding Medicine.
 */
function effectiveUnlock(unlock: DemoUnlock | null): DemoUnlock | null {
  if (!unlock) return null
  if (!previewEnabled(unlock.programme)) return null
  return unlock
}

export function isChallengeVisible(id: ChallengeId, unlock: DemoUnlock | null = null): boolean {
  const challenge = CHALLENGES.find((c) => c.id === id)
  if (!challenge) return false

  const active = effectiveUnlock(unlock)

  // Open and closed both stay on the public desk; closed is an archive.
  if (challenge.status === "open" || challenge.status === "closed") {
    if (active?.solo) return id === active.programme
    return true
  }

  // Preview: env must allow it. Unlock alone is never enough.
  if (!previewEnabled(id)) return false
  if (active?.solo) return id === active.programme
  return true
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
 * Default programme for the register form: prefer one that still accepts
 * listings. Closed archives stay browsable but are not offered for create.
 */
export function registerableChallengeIdOf(
  id: string | undefined | null,
  unlock: DemoUnlock | null = null,
): ChallengeId | null {
  const visible = visibleChallenges(unlock)
  const open = visible.filter((c) => acceptsNewListings(c.id))
  if (open.length === 0) return null
  if (id) {
    const resolved = challengeIdOf(id)
    if (open.some((c) => c.id === resolved)) return resolved
  }
  return open[0]!.id
}

export function registerableChallengeIds(unlock: DemoUnlock | null = null): readonly ChallengeId[] {
  return visibleChallenges(unlock)
    .filter((c) => acceptsNewListings(c.id))
    .map((c) => c.id)
}

/**
 * Where Browse / Directory should land.
 *
 * Preference order: active desk cookie → listing's programme → sole
 * visible programme → `/directory` chooser.
 */
export function browseDirectoryPath(
  listingChallengeId?: string | null,
  unlock: DemoUnlock | null = null,
  preferredChallengeId?: ChallengeId | null,
): string {
  const visible = visibleChallenges(unlock)
  const preferred = preferredChallengeId
    ? visible.find((c) => c.id === preferredChallengeId)
    : undefined
  if (preferred) return directoryHref(preferred.id)
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
