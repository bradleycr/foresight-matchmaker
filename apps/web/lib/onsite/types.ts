import type { Kind } from "@rmm/schema"
import type { OnsiteCitySlug } from "./cities"

/** One person on the room board. No email, no URL, no private fields. */
export interface OnsiteCard {
  id: string
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
