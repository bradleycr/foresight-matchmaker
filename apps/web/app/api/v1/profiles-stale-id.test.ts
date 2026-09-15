import { describe, it, expect, vi, beforeEach } from "vitest"

process.env.DATABASE_PATH = ":memory:"
process.env.SESSION_SECRET = "test-session-secret-not-for-real-use"
process.env.AUTH_REVEAL_LINKS = "true"
process.env.APP_URL = "https://foresightmatchmaker.app"

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

const loadOwnedListing = vi.fn()
vi.mock("@/lib/db/durable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/durable")>()
  return {
    ...actual,
    loadOwnedListing: (...args: unknown[]) => loadOwnedListing(...args),
    persistListing: vi.fn(async () => undefined),
    forgetListing: vi.fn(async () => undefined),
    ensureOwnedListing: vi.fn(async () => undefined),
  }
})

const { NextRequest } = await import("next/server")
const { PATCH: profilesPATCH } = await import("@/app/api/v1/profiles/[id]/route")
const { createSession, getSession } = await import("@/lib/auth/session")
const { saveProfile, getProfileById } = await import("@/lib/db/profiles")

function jsonRequest(url: string, method: string, body?: unknown): InstanceType<typeof NextRequest> {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  })
}

const listing = {
  kind: "individual" as const,
  org_name: "Cottrell Tamessar SE",
  org_type: "individual" as const,
  country: "SE",
  one_liner: "Disease modeling and biomarker discovery using nanoparticles.",
  summary: "Need multimodal cardiac datasets from both sexes.",
  languages: ["en"],
  looking_for: ["dataset_access"],
  application_status: "intend_to_apply" as const,
  parallel_public_funding: "no" as const,
  attending: [],
  open_to_intros: true,
  visibility: "public" as const,
  contact_name: "Cottrell",
  contact_email: "cottrell@example.invalid",
  contact_role: "Researcher",
  challenge_id: "recoding_medicine",
  methods: ["computer_vision"],
  application_target: ["diagnostics"],
  domain_expertise: ["oncology"],
  clinical_partner: "not_needed" as const,
  regulatory_experience: [],
  compute: "cloud_budget" as const,
  privacy_capability: ["can_work_in_tre"],
  team_size: "1" as const,
  track_record: [],
  data_needs: {
    modality: ["imaging_mri"],
    disease_area: ["cardiovascular"],
    linkage_required: [],
    standards_preferred: [],
  },
  affiliation: "Independent",
}

describe("PATCH /profiles/[id] stale UUID", () => {
  beforeEach(() => {
    cookieJar.clear()
    loadOwnedListing.mockReset()
  })

  it("updates the email-owned listing when the URL still carries a ghost id", async () => {
    const live = saveProfile(
      {
        ...listing,
        slug: "cottrell-tamessar-se",
        contact_email: "cottrell@example.invalid",
      },
      { isNew: true },
    )
    const ghostId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    await createSession(ghostId, "cottrell@example.invalid")
    loadOwnedListing.mockResolvedValue(live)

    const res = await profilesPATCH(
      jsonRequest(`/api/v1/profiles/${ghostId}`, "PATCH", {
        joint_application: "not_yet",
      }),
      { params: Promise.resolve({ id: ghostId }) },
    )

    expect(res.status).toBe(200)
    expect(loadOwnedListing).toHaveBeenCalledWith("cottrell@example.invalid", ghostId)
    const body = (await res.json()) as { joint_application: string }
    expect(body.joint_application).toBe("not_yet")
    expect(getProfileById(live.id)).toBeTruthy()

    const session = await getSession()
    expect(session?.profileId).toBe(live.id)
  })

  it("still 404s when the verified mailbox owns nothing", async () => {
    const ghostId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    await createSession(ghostId, "nobody@example.invalid")
    loadOwnedListing.mockResolvedValue(null)

    const res = await profilesPATCH(
      jsonRequest(`/api/v1/profiles/${ghostId}`, "PATCH", {
        joint_application: "yes",
      }),
      { params: Promise.resolve({ id: ghostId }) },
    )

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("No profile with that id.")
  })
})
