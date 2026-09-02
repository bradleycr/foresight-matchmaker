import { score } from "@rmm/matching"
import type { Profile } from "@rmm/schema"
import { MIN_SCORE } from "@/lib/db/matches"
import { SPOTLIGHT_MS } from "./rotation"
import type { OnsiteCard, OnsiteSpotlight } from "./types"

interface RankedPair {
  left: OnsiteCard
  right: OnsiteCard
  score: number
}

interface AnchorBlock {
  anchor: OnsiteCard
  partners: OnsiteCard[]
}

interface RoomSchedule {
  anchors: AnchorBlock[]
  slotCount: number
}

/** Partners shown per scarce org before the next anchor takes the top card. */
export const PARTNERS_PER_ANCHOR = 4

let scheduleCache: { key: string; schedule: RoomSchedule } | null = null

function roomKey(cards: readonly OnsiteCard[]): string {
  return cards
    .map((card) => card.id)
    .sort()
    .join("|")
}

/** Same-kind pairings read as noise on the wall; cross-kind is the point. */
export function isSpotlightPair(a: OnsiteCard, b: OnsiteCard): boolean {
  return a.kind !== b.kind
}

/**
 * The scarce side holds the top card. Data holders outrank consortia and
 * individuals; experts anchor when paired with an AI team.
 */
export function anchorForPair(a: OnsiteCard, b: OnsiteCard): OnsiteCard {
  if (a.kind === "data_holder") return a
  if (b.kind === "data_holder") return b
  if (a.kind === "consortium") return a
  if (b.kind === "consortium") return b
  if (a.kind === "individual") return a
  if (b.kind === "individual") return b
  return a
}

function partnerForPair(a: OnsiteCard, b: OnsiteCard, anchor: OnsiteCard): OnsiteCard {
  return anchor.id === a.id ? b : a
}

function blockSlotCount(partnerCount: number): number {
  if (partnerCount <= 0) return 0
  return Math.min(PARTNERS_PER_ANCHOR, partnerCount)
}

function compareCards(a: OnsiteCard, b: OnsiteCard): number {
  return a.org_name < b.org_name ? -1 : a.org_name > b.org_name ? 1 : a.id < b.id ? -1 : 1
}

/**
 * Cross-kind pairs who are both in the room, ordered by match score.
 * Same-kind matches are kept out of the spotlight queue.
 */
export function rankedPairs(cards: readonly OnsiteCard[], profiles: readonly Profile[]): RankedPair[] {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))
  const pairs: RankedPair[] = []
  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const left = cards[i]!
      const right = cards[j]!
      if (!isSpotlightPair(left, right)) continue
      const a = byId.get(left.id)
      const b = byId.get(right.id)
      if (!a || !b) continue
      const best = Math.max(score(a, b).score, score(b, a).score)
      if (best < MIN_SCORE) continue
      pairs.push({ left, right, score: best })
    }
  }
  pairs.sort((x, y) => (y.score !== x.score ? y.score - x.score : compareCards(x.left, y.left)))
  return pairs
}

function buildAnchorSchedule(cards: readonly OnsiteCard[], profiles: readonly Profile[]): RoomSchedule {
  const byPartner = new Map<string, Map<string, { card: OnsiteCard; score: number }>>()

  for (const pair of rankedPairs(cards, profiles)) {
    const anchor = anchorForPair(pair.left, pair.right)
    if (anchor.kind === "ai_team") continue
    const partner = partnerForPair(pair.left, pair.right, anchor)
    const bucket = byPartner.get(anchor.id) ?? new Map()
    const existing = bucket.get(partner.id)
    if (!existing || pair.score > existing.score) bucket.set(partner.id, { card: partner, score: pair.score })
    byPartner.set(anchor.id, bucket)
  }

  const anchors: AnchorBlock[] = []
  for (const card of cards) {
    if (card.kind === "ai_team") continue
    const bucket = byPartner.get(card.id)
    if (!bucket || bucket.size === 0) continue
    const partners = [...bucket.values()]
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : compareCards(a.card, b.card)))
      .map((entry) => entry.card)
    anchors.push({ anchor: card, partners })
  }

  const bestScore = (block: AnchorBlock): number => {
    const bucket = byPartner.get(block.anchor.id)
    if (!bucket || block.partners.length === 0) return 0
    return bucket.get(block.partners[0]!.id)?.score ?? 0
  }

  anchors.sort((a, b) => {
    const delta = bestScore(b) - bestScore(a)
    if (delta !== 0) return delta
    return compareCards(a.anchor, b.anchor)
  })

  const slotCount = anchors.reduce((total, block) => total + blockSlotCount(block.partners.length), 0)
  return { anchors, slotCount }
}

function getSchedule(cards: readonly OnsiteCard[], profiles: readonly Profile[]): RoomSchedule {
  const key = roomKey(cards)
  if (scheduleCache?.key === key) return scheduleCache.schedule
  const schedule = buildAnchorSchedule(cards, profiles)
  scheduleCache = { key, schedule }
  return schedule
}

/** Clears the in-process schedule cache — for tests only. */
export function clearSpotlightCache(): void {
  scheduleCache = null
}

function spotlightRotates(schedule: RoomSchedule): boolean {
  if (schedule.slotCount > 1) return true
  return schedule.anchors.some((block) => block.partners.length > 1)
}

/**
 * Scarce orgs and individuals hold the top card; AI teams rotate through the
 * bottom. Each full pass through the room shifts which slice of partners an
 * anchor shows, so the long tail of AI teams still gets airtime.
 */
export function pickSpotlight(
  cards: readonly OnsiteCard[],
  profiles: readonly Profile[],
  nowMs = Date.now(),
): OnsiteSpotlight | null {
  const schedule = getSchedule(cards, profiles)
  if (schedule.slotCount === 0) return null

  const slotGlobal = Math.floor(nowMs / SPOTLIGHT_MS)
  const passes = Math.floor(slotGlobal / schedule.slotCount)
  const slotInCycle = slotGlobal % schedule.slotCount

  let cursor = 0
  for (const block of schedule.anchors) {
    const slots = blockSlotCount(block.partners.length)
    if (slotInCycle < cursor + slots) {
      const slotInBlock = slotInCycle - cursor
      const partnerIdx = (passes * slots + slotInBlock) % block.partners.length
      return {
        left: block.anchor,
        right: block.partners[partnerIdx]!,
        rotates: spotlightRotates(schedule),
      }
    }
    cursor += slots
  }

  return null
}

/** @internal Test helper — how many 40s slots one full room rotation takes. */
export function spotlightSlotCount(cards: readonly OnsiteCard[], profiles: readonly Profile[]): number {
  return getSchedule(cards, profiles).slotCount
}
