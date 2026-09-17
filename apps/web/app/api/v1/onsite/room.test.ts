import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"
import type { OnsiteRoom } from "@/lib/onsite/types"

process.env.DATABASE_PATH = ":memory:"
process.env.SESSION_SECRET = "test-session-secret-not-for-real-use"

const cookieJar = new Map<string, string>()
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value)
    },
    delete: (name: string) => {
      cookieJar.delete(name)
    },
  }),
}))

vi.mock("@/lib/db/durable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/durable")>()
  return {
    ...actual,
    hydrateListings: vi.fn(async () => {}),
    hydrateEvents: vi.fn(async () => {}),
    persistEvent: vi.fn(async () => {}),
  }
})

vi.mock("@/lib/db/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/events")>()
  return {
    ...actual,
    flushEvent: vi.fn(async () => {}),
  }
})

const { NextRequest } = await import("next/server")
const { saveProfile } = await import("@/lib/db/profiles")
const { createSession } = await import("@/lib/auth/session")
const { logEvent } = await import("@/lib/db/events")
const { GET } = await import("@/app/api/v1/onsite/room/route")

beforeAll(async () => {
  const { getDb } = await import("@/lib/db/client")
  getDb()
})

afterEach(() => {
  cookieJar.clear()
})

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** An AI team seeking exactly what `holder` publishes — a scoring pair. */
function aiTeam(overrides: Record<string, unknown> = {}) {
  const slug = `room-team-${stamp()}`
  return saveProfile(
    {
      kind: "ai_team",
      org_name: `Room Lab ${slug}`,
      slug,
      org_type: "startup",
      country: "SE",
      one_liner: "Looking across the room.",
      summary: "Synthetic AI team for the phone room board tests.",
      languages: ["en"],
      looking_for: ["dataset_access"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["event_sept_3"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Room Contact",
      contact_email: `${slug}@example.invalid`,
      contact_role: "Lead",
      methods: ["computer_vision"],
      application_target: ["diagnostics"],
      domain_expertise: ["oncology"],
      clinical_partner: "need",
      regulatory_experience: ["gdpr_dpia"],
      compute: "own_cluster",
      privacy_capability: ["can_work_in_tre"],
      team_size: "6_15",
      track_record: [],
      data_needs: {
        modality: ["imaging_mri"],
        disease_area: ["oncology"],
        min_n_subjects: "1k_10k",
        linkage_required: ["outcomes"],
        standards_preferred: ["dicom"],
      },
      ...overrides,
    },
    { isNew: true },
  )
}

function holder(overrides: Record<string, unknown> = {}) {
  const slug = `room-holder-${stamp()}`
  return saveProfile(
    {
      kind: "data_holder",
      org_name: `Room Hospital ${slug}`,
      slug,
      org_type: "hospital",
      country: "SE",
      one_liner: "Oncology MRI, in the room tonight.",
      summary: "Synthetic data holder for the phone room board tests.",
      languages: ["en"],
      looking_for: ["ai_partner"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["event_sept_3"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Room Person",
      contact_email: `${slug}@example.invalid`,
      datasets: [
        {
          name: "Cohort",
          modality: ["imaging_mri"],
          disease_area: ["oncology"],
          n_subjects: "10k_100k",
          volume: "1_10tb",
          longitudinal: true,
          annotation: "expert_labelled",
          linkage: ["outcomes"],
          standards: ["dicom"],
          readiness: "ai_ready",
          consent_basis: "broad_consent",
          access_model: "dua_required",
          data_can_leave_institution: "yes",
          ethics_approval: "approved",
          publicly_describable: true,
        },
      ],
      ...overrides,
    },
    { isNew: true },
  )
}

function checkIn(profileId: string, city = "stockholm"): void {
  logEvent("onsite_checkin", profileId, { city })
}

function request(query = "?city=stockholm"): InstanceType<typeof NextRequest> {
  return new NextRequest(`http://localhost:3000/api/v1/onsite/room${query}`)
}

describe("GET /api/v1/onsite/room", () => {
  it("returns shortlist matches who are in the room", async () => {
    const viewer = aiTeam()
    const peer = holder()
    checkIn(viewer.id)
    checkIn(peer.id)
    await createSession(viewer.id, viewer.contact_email)

    const res = await GET(request())
    expect(res.status).toBe(200)
    const body = (await res.json()) as OnsiteRoom

    expect(body.city).toBe("stockholm")
    expect(body.everyone.map((card) => card.id)).toContain(peer.id)
    expect(body.everyone.map((card) => card.id)).not.toContain(viewer.id)
    const match = body.matches.find((card) => card.id === peer.id)
    expect(match).toBeDefined()
    expect(match!.score).toBeGreaterThanOrEqual(35)
    expect(match!.reasons.length).toBeGreaterThan(0)
  })

  it("never puts a contact email on the wire", async () => {
    const viewer = aiTeam()
    const peer = holder()
    checkIn(viewer.id)
    checkIn(peer.id)
    await createSession(viewer.id, viewer.contact_email)

    const body = await (await GET(request())).text()
    expect(body).not.toContain(peer.contact_email)
  })

  it("leaves out people who did not check in to this room", async () => {
    const viewer = aiTeam()
    const elsewhere = holder()
    checkIn(viewer.id)
    checkIn(elsewhere.id, "berlin")
    await createSession(viewer.id, viewer.contact_email)

    const body = (await (await GET(request())).json()) as OnsiteRoom
    expect(body.everyone.map((card) => card.id)).not.toContain(elsewhere.id)
    expect(body.matches.map((card) => card.id)).not.toContain(elsewhere.id)
  })

  it("keeps hidden listings off a peer's phone", async () => {
    const viewer = aiTeam()
    const invisible = holder({ visibility: "hidden" })
    checkIn(viewer.id)
    checkIn(invisible.id)
    await createSession(viewer.id, viewer.contact_email)

    const body = (await (await GET(request())).json()) as OnsiteRoom
    expect(body.everyone.map((card) => card.id)).not.toContain(invisible.id)
    expect(body.matches.map((card) => card.id)).not.toContain(invisible.id)
  })

  it("requires a signed-in listing", async () => {
    const res = await GET(request())
    expect(res.status).toBe(401)
  })

  it("refuses a city that is not a room", async () => {
    const viewer = aiTeam()
    await createSession(viewer.id, viewer.contact_email)
    const res = await GET(request("?city=london"))
    expect(res.status).toBe(400)
  })
})
