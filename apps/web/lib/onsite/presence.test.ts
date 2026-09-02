import { describe, expect, it } from "vitest"
import { buildAiTeam, buildDataHolder } from "../../../../packages/matching/src/__fixtures__/build"
import type { EventRow } from "@/lib/db/events"
import { cardFromProfile, checkInsForCity, isCheckedIn, presentCards } from "./presence"

const t = (key: string) => key.replace("enum.looking_for.", "").replace("enum.kind.", "")

function event(actorId: string, city: string, createdAt: string): EventRow {
  return {
    id: 1,
    uid: `uid-${actorId}`,
    type: "onsite_checkin",
    actorId,
    payload: { city },
    createdAt,
  }
}

describe("onsite presence", () => {
  it("keeps the first check-in time", () => {
    const holder = buildDataHolder()
    const rows = [
      event(holder.id, "berlin", "2026-09-02T18:00:00.000Z"),
      event(holder.id, "berlin", "2026-09-02T19:00:00.000Z"),
      event(holder.id, "paris", "2026-09-02T18:30:00.000Z"),
    ]
    const map = checkInsForCity(rows, "berlin")
    expect(map.get(holder.id)).toBe("2026-09-02T18:00:00.000Z")
    expect(isCheckedIn(rows, "berlin", holder.id)).toBe(true)
    expect(isCheckedIn(rows, "paris", holder.id)).toBe(true)
    expect(isCheckedIn(rows, "stockholm", holder.id)).toBe(false)
  })

  it("omits hidden listings from the board", () => {
    const visible = buildDataHolder({ org_name: "Visible Hospital" })
    const hidden = buildAiTeam({ org_name: "Hidden Lab", visibility: "hidden" })
    const checkIns = new Map([
      [visible.id, "2026-09-02T18:00:00.000Z"],
      [hidden.id, "2026-09-02T18:01:00.000Z"],
    ])
    const cards = presentCards([visible, hidden], checkIns, t)
    expect(cards).toHaveLength(1)
    expect(cards[0]?.org_name).toBe("Visible Hospital")
  })

  it("does not put email on a card", () => {
    const holder = buildDataHolder({ contact_email: "secret@example.invalid" })
    const card = cardFromProfile(holder, "2026-09-02T18:00:00.000Z", t)
    expect(JSON.stringify(card)).not.toContain("secret@")
    expect(card.slug).toBe(holder.slug)
  })

  it("fills the wall left-to-right, top-down — earliest check-in first", () => {
    const early = buildDataHolder({ org_name: "Early Hospital" })
    const late = buildAiTeam({ org_name: "Late Lab" })
    const checkIns = new Map([
      [early.id, "2026-09-02T18:00:00.000Z"],
      [late.id, "2026-09-02T18:30:00.000Z"],
    ])
    const cards = presentCards([early, late], checkIns, t)
    expect(cards.map((card) => card.org_name)).toEqual(["Early Hospital", "Late Lab"])
  })
})
