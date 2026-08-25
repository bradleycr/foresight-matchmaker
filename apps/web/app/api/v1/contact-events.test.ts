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
const { POST } = await import("@/app/api/v1/contact-events/route")

function jsonRequest(url: string, method: string, body?: unknown): InstanceType<typeof NextRequest> {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  })
}

async function signInAs(profileId: string, email: string): Promise<void> {
  cookieJar.clear()
  await createSession(profileId, email)
}

function makeAiTeam(slug: string) {
  return saveProfile(
    {
      kind: "ai_team",
      org_name: `Contact Events ${slug}`,
      slug,
      org_type: "startup",
      country: "FR",
      one_liner: "A test AI team.",
      summary: "Synthetic profile for contact-click route tests.",
      languages: ["en"],
      looking_for: ["dataset_access"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["webinar_2026_08_20"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Test Contact",
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
    },
    { isNew: true },
  )
}

let actor: ReturnType<typeof makeAiTeam>
let target: ReturnType<typeof makeAiTeam>

beforeAll(() => {
  actor = makeAiTeam("contact-click-actor")
  target = makeAiTeam("contact-click-target")
})

afterEach(() => {
  cookieJar.clear()
})

describe("POST /api/v1/contact-events", () => {
  it("rejects without a session", async () => {
    const res = await POST(jsonRequest("/api/v1/contact-events", "POST", { to_id: target.id, channel: "email" }))
    expect(res.status).toBe(401)
  })

  it("records a signed-in click once, then reports already", async () => {
    await signInAs(actor.id, actor.contact_email)
    const first = await POST(
      jsonRequest("/api/v1/contact-events", "POST", { to_id: target.id, channel: "email" }),
    )
    expect(first.status).toBe(201)
    const firstBody = (await first.json()) as { recorded: boolean }
    expect(firstBody.recorded).toBe(true)

    const second = await POST(
      jsonRequest("/api/v1/contact-events", "POST", { to_id: target.id, channel: "email" }),
    )
    expect(second.status).toBe(200)
    const secondBody = (await second.json()) as { recorded: boolean; already?: boolean }
    expect(secondBody.recorded).toBe(false)
    expect(secondBody.already).toBe(true)
  })

  it("does not record a click on your own listing", async () => {
    await signInAs(actor.id, actor.contact_email)
    const res = await POST(jsonRequest("/api/v1/contact-events", "POST", { to_id: actor.id, channel: "email" }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { recorded: boolean; self?: boolean }
    expect(body.recorded).toBe(false)
    expect(body.self).toBe(true)
  })
})
