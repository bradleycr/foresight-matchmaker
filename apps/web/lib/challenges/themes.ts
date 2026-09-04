import type { ChallengeId } from "@rmm/schema"

/**
 * Per-programme wash — a barely-there shift from the platform default so
 * visitors know which challenge they are browsing. Add a row when a new
 * programme ships; copy lives in locales, colours live here.
 *
 * Recoding Medicine: SPRIND’s health challenge reads slightly warmer and
 * greener than Foresight’s cool sky paper — we echo that without leaving
 * the Foresight palette.
 */

export interface ChallengeTheme {
  /** Full-page background (via `html[data-programme]`). */
  paper: string
  /** Cards, hovers, inset panels. */
  paperShade: string
  /** Dividers and borders. */
  rule: string
  /** Kicker, section rules, primary chips. */
  accent: string
}

/** Platform default — cool Foresight powder blue (matches globals.css). */
export const PLATFORM_THEME: ChallengeTheme = {
  paper: "#e5f0f6",
  paperShade: "#d5e6ee",
  rule: "#b8cdd4",
  accent: "#2f9f96",
}

const CHALLENGE_THEMES: Partial<Record<ChallengeId, Partial<ChallengeTheme>>> = {
  recoding_medicine: {
    paper: "#e8f0ee",
    paperShade: "#d6e6e2",
    rule: "#b4ccc4",
    accent: "#2a8f86",
  },
  // Cooler ink-blue: a community room, not a health-challenge wash.
  ai_safety_berlin: {
    paper: "#e6ebf2",
    paperShade: "#d4dce8",
    rule: "#b0bbcc",
    accent: "#3d5a80",
  },
}

export function challengeTheme(id: ChallengeId): ChallengeTheme {
  const overrides = CHALLENGE_THEMES[id]
  if (!overrides) return PLATFORM_THEME
  return { ...PLATFORM_THEME, ...overrides }
}
