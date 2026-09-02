import type { Kind } from "@rmm/schema"

/**
 * Room-board skins — left rail plus wash. Four kinds, four colours, one
 * object from the legend to the wall tiles.
 */
export const KIND_SKIN: Record<Kind, string> = {
  data_holder: "border-l-teal bg-tint-teal",
  ai_team: "border-l-mark bg-tint-mark",
  consortium: "border-l-ink bg-tint-ink",
  individual: "border-l-brown bg-tint-brown",
}

/** Kinds shown on the projector legend, in display order. */
export const KIND_LEGEND: Kind[] = ["data_holder", "ai_team", "consortium", "individual"]
