import type { CSSProperties } from "react"
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
  /** Page background — replaces `--color-paper` inside `.programme-surface`. */
  paper: string
  /** Cards, hovers, inset panels. */
  paperShade: string
  /** Dividers and borders. */
  rule: string
  /** Kicker, section rules, primary chips — falls back to platform teal. */
  accent: string
  /** Optional thin band above programme content (defaults to platform band). */
  band?: string
}

/** Platform default — cool Foresight powder blue (matches globals.css). */
export const PLATFORM_THEME: ChallengeTheme = {
  paper: "#e5f0f6",
  paperShade: "#d5e6ee",
  rule: "#b8cdd4",
  accent: "#2f9f96",
  band: "linear-gradient(90deg, #5bb8d4 0%, #2f9f96 48%, #7ed6a5 100%)",
}

const CHALLENGE_THEMES: Partial<Record<ChallengeId, Partial<ChallengeTheme>>> = {
  recoding_medicine: {
    paper: "#e8f0ee",
    paperShade: "#d6e6e2",
    rule: "#b4ccc4",
    accent: "#2a8f86",
    band: "linear-gradient(90deg, #8ec4b8 0%, #2a8f86 52%, #a8dcc8 100%)",
  },
}

export function challengeTheme(id: ChallengeId): ChallengeTheme {
  const overrides = CHALLENGE_THEMES[id]
  if (!overrides) return PLATFORM_THEME
  return { ...PLATFORM_THEME, ...overrides }
}

/** Inline custom properties for a `.programme-surface` wrapper. */
export function challengeThemeStyle(theme: ChallengeTheme): CSSProperties {
  return {
    "--programme-paper": theme.paper,
    "--programme-paper-shade": theme.paperShade,
    "--programme-rule": theme.rule,
    "--programme-accent": theme.accent,
    "--programme-band": theme.band ?? PLATFORM_THEME.band,
  } as CSSProperties
}
