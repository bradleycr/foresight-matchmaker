import type { Kind } from "@rmm/schema"
import type { OnsiteCitySlug } from "./cities"

/** One person on the room board. Slug is public; profile opens after sign-in. */
export interface OnsiteCard {
  id: string
  slug: string
  org_name: string
  kind: Kind
  kind_label: string
  one_liner: string
  looking_for: string[]
  arrived_at: string
}

export interface OnsiteSpotlight {
  left: OnsiteCard
  right: OnsiteCard
  /** False when only one pair qualifies — the board then hides the countdown. */
  rotates: boolean
}

export interface OnsiteFeed {
  city: OnsiteCitySlug
  city_label: string
  date_label: string
  count: number
  people: OnsiteCard[]
  spotlight: OnsiteSpotlight | null
}

/** A shortlist match who is also standing in the room. */
export interface OnsiteRoomMatch extends OnsiteCard {
  score: number
  /** Strongest factors, already localised — a phone card cannot hold prose. */
  reasons: string[]
}

/**
 * The phone view after check-in. `count` matches the projector so the two
 * screens never disagree; `everyone` excludes the viewer, who already knows
 * they are here.
 */
export interface OnsiteRoom {
  city: OnsiteCitySlug
  city_label: string
  count: number
  matches: OnsiteRoomMatch[]
  everyone: OnsiteCard[]
}
