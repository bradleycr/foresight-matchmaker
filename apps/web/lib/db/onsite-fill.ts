/**
 * Local rehearsal only. Marks ~22 public seed listings as here in Berlin
 * so the HDMI board can be judged at room density.
 *
 * Writes SQLite directly — never logEvent, never the durable store.
 * Refuse to run on Vercel or production.
 *
 *   pnpm --filter @rmm/web exec tsx lib/db/onsite-fill.ts
 */
import { randomUUID } from "node:crypto"
import type { Profile } from "@rmm/schema"
import { getDb } from "./client"
import { events } from "./schema"
import { listEvents } from "./events"
import { listProfiles } from "./profiles"

const CITY = "berlin"
const TARGET = 22

if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  console.error("onsite-fill is local SQLite only.")
  process.exit(1)
}

function pickRoom(pool: readonly Profile[], n: number): Profile[] {
  const buckets: Profile[][] = [[], [], []]
  for (const profile of pool) {
    if (profile.kind === "data_holder") buckets[0]!.push(profile)
    else if (profile.kind === "ai_team") buckets[1]!.push(profile)
    else buckets[2]!.push(profile)
  }
  const out: Profile[] = []
  let i = 0
  while (out.length < n && buckets.some((b) => b.length > 0)) {
    const bucket = buckets[i % buckets.length]!
    const next = bucket.shift()
    if (next) out.push(next)
    i += 1
  }
  return out
}

const already = new Set(
  listEvents()
    .filter((event) => event.type === "onsite_checkin" && event.payload.city === CITY && event.actorId)
    .map((event) => event.actorId!),
)

const visible = listProfiles().filter((profile) => profile.visibility !== "hidden")
const berlin = visible.filter((profile) => profile.attending.includes("event_sept_1"))
const others = visible.filter((profile) => !profile.attending.includes("event_sept_1"))
const pool = [...berlin, ...others].filter((profile) => !already.has(profile.id))
const need = Math.max(0, TARGET - already.size)
const chosen = pickRoom(pool, need)

const db = getDb()
const base = Date.now()
for (const [index, profile] of chosen.entries()) {
  db.insert(events)
    .values({
      uid: randomUUID(),
      type: "onsite_checkin",
      actorId: profile.id,
      payload: JSON.stringify({ city: CITY, preview: true }),
      createdAt: new Date(base - (chosen.length - index) * 90_000).toISOString(),
    })
    .run()
}

const total = already.size + chosen.length
console.log(
  `Berlin board: ${total} here (${chosen.length} added, ${already.size} already). Mix: ${chosen.map((p) => p.kind).join(", ") || "none"}.`,
)
