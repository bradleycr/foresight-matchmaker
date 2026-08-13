import { hasAiCapabilityKind, hasDatasetKind } from "@rmm/schema"
import type { Profile, Dataset, DataNeeds } from "./types"

/** Does this profile carry datasets (data_holder or consortium)? */
export function hasDatasets(p: Profile): p is Extract<Profile, { datasets: Dataset[] }> {
  return hasDatasetKind(p.kind)
}

/** Does this profile carry AI capability fields (ai_team, consortium, or individual)? */
export function hasAiFields(p: Profile): p is Extract<Profile, { data_needs: DataNeeds }> {
  return hasAiCapabilityKind(p.kind)
}

/**
 * A consortium is only "in the market" for matching when `still_seeking` is
 * non-empty. A consortium with an empty `still_seeking` is directory-visible
 * but generates no matches.
 */
export function consortiumIsSeeking(p: Profile): boolean {
  if (p.kind !== "consortium") return true
  return Array.isArray(p.still_seeking) && p.still_seeking.length > 0
}

/** Jaccard similarity of two arrays treated as sets. Empty ∩ empty = 0. */
export function jaccard<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const x of setA) if (setB.has(x)) intersection++
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

export function unique<T>(arr: readonly T[]): T[] {
  return [...new Set(arr)]
}

export function overlaps<T>(a: readonly T[], b: readonly T[]): boolean {
  const setB = new Set(b)
  return a.some((x) => setB.has(x))
}
