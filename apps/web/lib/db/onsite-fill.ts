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
import { listProfiles, saveProfile } from "./profiles"

const CITY = "berlin"
const TARGET = 22

/** Local rehearsal experts — brown cards on the wall when seed has no individuals. */
const PREVIEW_INDIVIDUALS = [
  { slug: "preview-dr-chen", org_name: "Dr. Alex Chen", one_liner: "Clinical ML lead open to joining an imaging AI team." },
  { slug: "preview-sarah-klein", org_name: "Sarah Klein", one_liner: "Regulatory strategist for SaMD and EU MDR." },
  { slug: "preview-james-ortiz", org_name: "James Ortiz", one_liner: "Radiologist with federated learning experience." },
] as const

if (process.env.VERCEL || process.env.NODE_ENV === "production") {
  console.error("onsite-fill is local SQLite only.")
  process.exit(1)
}

function ensurePreviewIndividuals(): Profile[] {
  const out: Profile[] = []
  for (const preview of PREVIEW_INDIVIDUALS) {
    const existing = listProfiles().find((profile) => profile.slug === preview.slug)
    if (existing) {
      out.push(existing)
      continue
    }
    out.push(
      saveProfile(
        {
          kind: "individual",
          org_name: preview.org_name,
          slug: preview.slug,
          org_type: "individual",
          country: "DE",
          one_liner: preview.one_liner,
          summary: preview.one_liner,
          languages: ["en"],
          looking_for: ["join_team"],
          application_status: "intend_to_apply",
          parallel_public_funding: "no",
          attending: ["event_sept_1"],
          open_to_intros: true,
          visibility: "public",
          contact_name: preview.org_name,
          contact_email: `${preview.slug}@preview.invalid`,
          methods: ["computer_vision"],
          application_target: ["diagnostics"],
          domain_expertise: ["oncology"],
          clinical_partner: "not_needed",
          regulatory_experience: [],
          compute: "cloud_budget",
          privacy_capability: ["can_work_in_tre"],
          team_size: "1",
          track_record: [],
          data_needs: {
            modality: ["imaging_mri"],
            disease_area: ["oncology"],
            linkage_required: [],
            standards_preferred: [],
          },
        },
        { isNew: true },
      ),
    )
  }
  return out
}

function pickRoom(pool: readonly Profile[], n: number): Profile[] {
  const buckets: Record<Profile["kind"], Profile[]> = {
    data_holder: [],
    ai_team: [],
    consortium: [],
    individual: [],
  }
  for (const profile of pool) buckets[profile.kind].push(profile)

  const order: Profile["kind"][] = ["data_holder", "ai_team", "consortium", "individual"]
  const out: Profile[] = []
  let i = 0
  while (out.length < n && order.some((kind) => buckets[kind].length > 0)) {
    const kind = order[i % order.length]!
    const next = buckets[kind].shift()
    if (next) out.push(next)
    i += 1
  }
  return out
}

const previewIndividuals = ensurePreviewIndividuals()

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

// Always show brown individual cards in local rehearsal.
const forced = previewIndividuals.filter((profile) => !already.has(profile.id))
const toCheckIn = [...forced, ...chosen.filter((profile) => !forced.some((p) => p.id === profile.id))]

const db = getDb()
const base = Date.now()
for (const [index, profile] of toCheckIn.entries()) {
  db.insert(events)
    .values({
      uid: randomUUID(),
      type: "onsite_checkin",
      actorId: profile.id,
      payload: JSON.stringify({ city: CITY, preview: true }),
      createdAt: new Date(base - (toCheckIn.length - index) * 90_000).toISOString(),
    })
    .run()
}

const total = already.size + toCheckIn.length
console.log(
  `Berlin board: ${total} here (${toCheckIn.length} added, ${already.size} already). Mix: ${toCheckIn.map((p) => p.kind).join(", ") || "none"}.`,
)
