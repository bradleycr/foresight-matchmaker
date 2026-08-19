import { listProfiles, deleteProfile } from "./profiles"
import { recomputeAllMatches } from "./matches"

/**
 * Fabricated seed contacts use the reserved `.invalid` TLD (RFC 2606).
 * Operator logins and real registrations use ordinary domains — never this.
 */
export function isSyntheticContactEmail(email: string): boolean {
  const host = email.trim().toLowerCase().split("@").pop() ?? ""
  return host === "invalid" || host.endsWith(".invalid")
}

/**
 * Remove golden/bulk seed listings. Keeps operator accounts and any profile
 * a real person registered. Rebuilds the match cache for whoever remains.
 *
 * Do not follow this with `db:reset` — that reseeds the fakes.
 */
export function purgeSyntheticProfiles(): { removed: number; kept: number } {
  let removed = 0
  let kept = 0
  for (const profile of listProfiles()) {
    if (isSyntheticContactEmail(profile.contact_email)) {
      deleteProfile(profile.id)
      removed += 1
    } else {
      kept += 1
    }
  }
  recomputeAllMatches()
  return { removed, kept }
}
