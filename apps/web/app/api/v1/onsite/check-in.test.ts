import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"

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
const { POST } = await import("@/app/api/v1/onsite/check-in/route")

beforeAll(async () => {
  const { getDb } = await import("@/lib/db/client")
  getDb()
})

afterEach(() => {
  cookieJar.clear()
})

function holder() {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return saveProfile(
    {
      kind: "data_holder",
      org_name: `Onsite Hospital ${stamp}`,
      slug: `onsite-hospital-${stamp}`,
      org_type: "hospital",
      country: "DE",
      one_liner: "Here tonight.",
      summary: "A listing used to check in.",
      languages: ["en"],
      looking_for: ["ai_partner"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["event_sept_1"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Onsite Person",
      contact_email: `onsite-${stamp}@example.invalid`,
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
    },
    { isNew: true },
  )
}

describe("POST /api/v1/onsite/check-in", () => {
  it("records presence for a signed-in listing", async () => {
    const profile = holder()
    await createSession(profile.id, profile.contact_email)
    const req = new NextRequest("http://localhost:3000/api/v1/onsite/check-in", {
      method: "POST",
      body: JSON.stringify({ city: "berlin" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { recorded: boolean }
    expect(body.recorded).toBe(true)
  })

  it("is idempotent on a second tap", async () => {
    const profile = holder()
    await createSession(profile.id, profile.contact_email)
    const req = () =>
      new NextRequest("http://localhost:3000/api/v1/onsite/check-in", {
        method: "POST",
        body: JSON.stringify({ city: "berlin" }),
        headers: { "content-type": "application/json" },
      })
    await POST(req())
    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { already: boolean }
    expect(body.already).toBe(true)
  })

  it("refuses a city that is not a room", async () => {
    const profile = holder()
    await createSession(profile.id, profile.contact_email)
    const req = new NextRequest("http://localhost:3000/api/v1/onsite/check-in", {
      method: "POST",
      body: JSON.stringify({ city: "london" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
