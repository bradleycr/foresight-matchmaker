import type { Profile } from "@rmm/schema"

/**
 * The single field most likely to unlock matches — shared by the matches
 * empty-state and Remmy’s generative “gaps” card.
 */
export function nudgeField(profile: Profile): string {
  if (profile.parallel_public_funding === "yes") return "parallel_public_funding"
  if (profile.application_status === "not_applying" || profile.application_status === "team_complete") {
    return "application_status"
  }
  if (!profile.open_to_intros) return "open_to_intros"
  if (profile.kind === "ai_team" || profile.kind === "consortium" || profile.kind === "individual") {
    if (profile.privacy_capability.length === 0) return "privacy_capability"
    if (profile.data_needs.modality.length === 0) return "data_needs"
  }
  if (profile.kind === "data_holder" || profile.kind === "consortium") {
    if (profile.datasets.some((d) => d.access_model === "undecided")) return "access_model"
  }
  if (profile.languages.length === 0) return "languages"
  return "attending"
}
