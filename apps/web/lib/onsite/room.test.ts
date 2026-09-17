import { describe, expect, it } from "vitest"
import type { Factor } from "@rmm/matching"
import { buildAiTeam, buildDataHolder, buildIndividual } from "../../../../packages/matching/src/__fixtures__/build"
import type { EventRow } from "@/lib/db/events"
import { buildOnsiteRoom, matchReasons, type RoomShortlistEntry } from "./room"

const t = (key: string) =>
  key.replace("enum.looking_for.", "").replace("enum.kind.", "").replace("factor.", "").replace("onsite.city.", "")

function checkIn(actorId: string, city: string, createdAt: string): EventRow {
  return {
    id: 1,
    uid: `uid-${actorId}-${createdAt}`,
    type: "onsite_checkin",
    actorId,
    payload: { city },
    createdAt,
  }
}

function factor(key: string, earned: number, weight: number): Factor {
  return { key, weight, earned, note: `${key} note` }
}

function entry(otherId: string, score: number, factors: Factor[] = []): RoomShortlistEntry {
  return { otherId, score, factors }
}

describe("matchReasons", () => {
  it("ranks by proportion earned, not raw points", () => {
    const reasons = matchReasons(
      [factor("modality_fit", 6, 6), factor("disease_area_fit", 12, 20), factor("scale_fit", 8, 10)],
      t,
    )
    expect(reasons).toEqual(["modality_fit", "scale_fit"])
  })

  it("skips factors that earned nothing or cannot be earned", () => {
    const reasons = matchReasons(
      [factor("language_fit", 0, 4), factor("colocation_fit", 0, 0), factor("modality_fit", 3, 6)],
      t,
    )
    expect(reasons).toEqual(["modality_fit"])
  })
})

describe("buildOnsiteRoom", () => {
  it("keeps only shortlist matches who are in the room, best score first", () => {
    const viewer = buildAiTeam({ org_name: "Viewer Lab" })
    const strong = buildDataHolder({ org_name: "Strong Hospital" })
    const weaker = buildDataHolder({ org_name: "Weaker Registry" })
    const absent = buildDataHolder({ org_name: "Absent Biobank" })

    const room = buildOnsiteRoom({
      city: "stockholm",
      viewerId: viewer.id,
      profiles: [viewer, strong, weaker, absent],
      events: [
        checkIn(viewer.id, "stockholm", "2026-09-17T16:00:00.000Z"),
        checkIn(weaker.id, "stockholm", "2026-09-17T16:01:00.000Z"),
        checkIn(strong.id, "stockholm", "2026-09-17T16:02:00.000Z"),
      ],
      shortlist: [
        entry(weaker.id, 51, [factor("modality_fit", 6, 6)]),
        entry(strong.id, 88, [factor("disease_area_fit", 20, 20)]),
        entry(absent.id, 95),
      ],
      t,
    })

    expect(room.matches.map((match) => match.org_name)).toEqual(["Strong Hospital", "Weaker Registry"])
    expect(room.matches[0]?.score).toBe(88)
    expect(room.matches[0]?.reasons).toEqual(["disease_area_fit"])
  })

  it("counts the viewer in the room total but leaves them off the lists", () => {
    const viewer = buildAiTeam({ org_name: "Viewer Lab" })
    const other = buildDataHolder({ org_name: "Other Hospital" })

    const room = buildOnsiteRoom({
      city: "stockholm",
      viewerId: viewer.id,
      profiles: [viewer, other],
      events: [
        checkIn(viewer.id, "stockholm", "2026-09-17T16:00:00.000Z"),
        checkIn(other.id, "stockholm", "2026-09-17T16:05:00.000Z"),
      ],
      shortlist: [entry(viewer.id, 99), entry(other.id, 60)],
      t,
    })

    expect(room.count).toBe(2)
    expect(room.everyone.map((card) => card.org_name)).toEqual(["Other Hospital"])
    expect(room.matches.map((card) => card.org_name)).toEqual(["Other Hospital"])
  })

  it("omits hidden listings even when they checked in", () => {
    const viewer = buildAiTeam({ org_name: "Viewer Lab" })
    const hidden = buildDataHolder({ org_name: "Hidden Hospital", visibility: "hidden" })

    const room = buildOnsiteRoom({
      city: "stockholm",
      viewerId: viewer.id,
      profiles: [viewer, hidden],
      events: [
        checkIn(viewer.id, "stockholm", "2026-09-17T16:00:00.000Z"),
        checkIn(hidden.id, "stockholm", "2026-09-17T16:01:00.000Z"),
      ],
      shortlist: [entry(hidden.id, 92)],
      t,
    })

    expect(room.count).toBe(1)
    expect(room.everyone).toEqual([])
    expect(room.matches).toEqual([])
  })

  it("ignores check-ins from another city", () => {
    const viewer = buildAiTeam({ org_name: "Viewer Lab" })
    const paris = buildDataHolder({ org_name: "Paris Hospital" })

    const room = buildOnsiteRoom({
      city: "stockholm",
      viewerId: viewer.id,
      profiles: [viewer, paris],
      events: [
        checkIn(viewer.id, "stockholm", "2026-09-17T16:00:00.000Z"),
        checkIn(paris.id, "paris", "2026-09-09T16:00:00.000Z"),
      ],
      shortlist: [entry(paris.id, 77)],
      t,
    })

    expect(room.everyone).toEqual([])
    expect(room.matches).toEqual([])
  })

  it("orders everyone by arrival, and never leaks an email", () => {
    const viewer = buildAiTeam({ org_name: "Viewer Lab" })
    const late = buildIndividual({ org_name: "Late Expert", affiliation: "" })
    const early = buildDataHolder({ org_name: "Early Hospital", contact_email: "secret@example.invalid" })

    const room = buildOnsiteRoom({
      city: "stockholm",
      viewerId: viewer.id,
      profiles: [viewer, late, early],
      events: [
        checkIn(late.id, "stockholm", "2026-09-17T17:00:00.000Z"),
        checkIn(early.id, "stockholm", "2026-09-17T16:00:00.000Z"),
      ],
      shortlist: [],
      t,
    })

    expect(room.everyone.map((card) => card.org_name)).toEqual(["Early Hospital", "Late Expert"])
    expect(JSON.stringify(room)).not.toContain("secret@")
  })
})
