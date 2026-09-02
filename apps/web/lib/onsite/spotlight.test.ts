import { describe, expect, it, beforeEach } from "vitest"
import {
  buildAiTeam,
  buildConsortium,
  buildDataHolder,
  buildIndividual,
} from "../../../../packages/matching/src/__fixtures__/build"
import { SPOTLIGHT_MS } from "./rotation"
import { cardFromProfile } from "./presence"
import {
  PARTNERS_PER_ANCHOR,
  anchorForPair,
  clearSpotlightCache,
  isSpotlightPair,
  pickSpotlight,
  rankedPairs,
  spotlightSlotCount,
} from "./spotlight"

const t = (key: string) => key

describe("onsite spotlight", () => {
  beforeEach(() => {
    clearSpotlightCache()
  })

  it("pairs a data holder with an AI team who are both in the room", () => {
    const holder = buildDataHolder({ looking_for: ["ai_partner"] })
    const team = buildAiTeam({ looking_for: ["dataset_access"] })
    const cards = [
      cardFromProfile(holder, "2026-09-02T18:00:00.000Z", t),
      cardFromProfile(team, "2026-09-02T18:01:00.000Z", t),
    ]
    const pairs = rankedPairs(cards, [holder, team])
    expect(pairs.length).toBeGreaterThan(0)
    expect(pairs[0]?.score).toBeGreaterThanOrEqual(35)
  })

  it("drops same-kind pairings from the spotlight queue", () => {
    const a = buildAiTeam({ looking_for: ["dataset_access"] })
    const b = buildAiTeam({ looking_for: ["dataset_access"] })
    const cards = [
      cardFromProfile(a, "2026-09-02T18:00:00.000Z", t),
      cardFromProfile(b, "2026-09-02T18:01:00.000Z", t),
    ]
    expect(isSpotlightPair(cards[0]!, cards[1]!)).toBe(false)
    expect(rankedPairs(cards, [a, b])).toHaveLength(0)
    expect(pickSpotlight(cards, [a, b], 0)).toBeNull()
  })

  it("returns nothing for a single person", () => {
    const holder = buildDataHolder()
    const cards = [cardFromProfile(holder, "2026-09-02T18:00:00.000Z", t)]
    expect(pickSpotlight(cards, [holder], 0)).toBeNull()
  })

  it("keeps the scarce org on top while AI partners rotate", () => {
    const holder = buildDataHolder({ looking_for: ["ai_partner"], org_name: "Delta Hospital" })
    const teamA = buildAiTeam({ looking_for: ["dataset_access"], org_name: "Helix Vision" })
    const teamB = buildAiTeam({ looking_for: ["dataset_access"], org_name: "Vector Imaging" })
    const profiles = [holder, teamA, teamB]
    const cards = profiles.map((profile, index) =>
      cardFromProfile(profile, `2026-09-02T18:0${index}:00.000Z`, t),
    )

    const first = pickSpotlight(cards, profiles, 0)!
    expect(first.left.org_name).toBe("Delta Hospital")
    expect(first.rotates).toBe(true)

    const second = pickSpotlight(cards, profiles, SPOTLIGHT_MS)!
    expect(second.left.org_name).toBe("Delta Hospital")
    expect(second.right.org_name).not.toBe(first.right.org_name)
  })

  it("puts the data holder on top for a data-holder + consortium match", () => {
    const holder = buildDataHolder({ org_name: "Nordhavn Imaging Bank" })
    const consortium = buildConsortium({ org_name: "Oncology Imaging AI" })
    const cards = [
      cardFromProfile(consortium, "2026-09-02T18:00:00.000Z", t),
      cardFromProfile(holder, "2026-09-02T18:01:00.000Z", t),
    ]
    expect(anchorForPair(cards[0]!, cards[1]!).org_name).toBe("Nordhavn Imaging Bank")

    const spotlight = pickSpotlight(cards, [holder, consortium], 0)
    if (spotlight) expect(spotlight.left.kind).toBe("data_holder")
  })

  it("anchors an individual above an AI team in spotlight", () => {
    const expert = buildIndividual({ org_name: "Dr. Alex Chen", looking_for: ["join_team"] })
    const team = buildAiTeam({ looking_for: ["dataset_access"], org_name: "Helix Vision" })
    const cards = [
      cardFromProfile(team, "2026-09-02T18:00:00.000Z", t),
      cardFromProfile(expert, "2026-09-02T18:01:00.000Z", t),
    ]
    expect(anchorForPair(cards[0]!, cards[1]!).org_name).toBe("Dr. Alex Chen")

    const spotlight = pickSpotlight(cards, [expert, team], 0)
    expect(spotlight?.left.kind).toBe("individual")
    expect(spotlight?.right.kind).toBe("ai_team")
  })

  it("shifts partner slice after a full room pass", () => {
    const holder = buildDataHolder({ looking_for: ["ai_partner"] })
    const teams = Array.from({ length: 6 }, (_, index) =>
      buildAiTeam({ looking_for: ["dataset_access"], org_name: `AI Team ${index + 1}` }),
    )
    const profiles = [holder, ...teams]
    const cards = profiles.map((profile, index) =>
      cardFromProfile(profile, `2026-09-02T18:${String(index).padStart(2, "0")}:00.000Z`, t),
    )

    const slots = spotlightSlotCount(cards, profiles)
    expect(slots).toBe(PARTNERS_PER_ANCHOR)

    const pass0 = pickSpotlight(cards, profiles, 0)!
    const pass1 = pickSpotlight(cards, profiles, slots * SPOTLIGHT_MS)!
    expect(pass0.left.id).toBe(pass1.left.id)
    expect(pass0.right.id).not.toBe(pass1.right.id)
  })
})
