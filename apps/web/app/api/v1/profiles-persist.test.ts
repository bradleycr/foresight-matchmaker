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

vi.mock("@/lib/db/durable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/durable")>()
  return {
    ...actual,
    persistListing: vi.fn(async () => {
      throw new Error("durable down")
    }),
  }
})

const { NextRequest } = await import("next/server")
const { POST: requestLink } = await import("@/app/api/v1/auth/request-link/route")
const { POST: claim } = await import("@/app/api/v1/auth/claim/route")
const { POST: profilesPOST } = await import("@/app/api/v1/profiles/route")
const { PATCH: profilesPATCH } = await import("@/app/api/v1/profiles/[id]/route")
const { getSession } = await import("@/lib/auth/session")

function jsonRequest(url: string, method: string, body?: unknown): InstanceType<typeof NextRequest> {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  })
}

function tokenFromClaimLink(link: string): string {
  const parts = new URL(link).pathname.split("/").filter(Boolean)
  const i = parts.indexOf("claim")
  const token = i >= 0 ? parts[i + 1] : ""
  if (!token) throw new Error("claim link had no token")
  return token
}

const listing = {
  kind: "ai_team",
  org_name: "Persist-Miss Test Lab",
  org_type: "startup",
  country: "DE",
  one_liner: "Create should not look successful when durable persist fails.",
  summary: "Synthetic profile for honest 503 persist tests.",
  languages: ["en"],
  looking_for: ["dataset_access"],
  application_status: "intend_to_apply",
  parallel_public_funding: "no",
  attending: ["webinar_2026_08_20"],
  open_to_intros: true,
  visibility: "public",
  contact_name: "Ada",
  contact_email: "ignored@example.invalid",
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
}

async function confirmEmail(email: string): Promise<void> {
  const requested = await requestLink(
    jsonRequest("/api/v1/auth/request-link", "POST", { email, next: "/register" }),
  )
  const { claim_link } = (await requested.json()) as { claim_link: string }
  await claim(jsonRequest("/api/v1/auth/claim", "POST", { token: tokenFromClaimLink(claim_link) }))
}

beforeEach(() => {
  cookieJar.clear()
})

describe("durable persist failure is an honest 503", () => {
  it("returns 503 on POST create and still binds the session cookie", async () => {
    await confirmEmail("persist-create@example.invalid")

    const created = await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    expect(created.status).toBe(503)
    const body = (await created.json()) as { error?: string }
    expect(body.error).toMatch(/lasting copy/i)

    const session = await getSession()
    expect(session?.email).toBe("persist-create@example.invalid")
    expect(session?.profileId).toBeTruthy()
  })

  it("returns 503 on POST when the listing already exists locally", async () => {
    await confirmEmail("persist-existing@example.invalid")
    await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))

    const again = await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    expect(again.status).toBe(503)
    const body = (await again.json()) as { error?: string }
    expect(body.error).toMatch(/lasting copy/i)
  })

  it("returns 503 on PATCH full edit", async () => {
    await confirmEmail("persist-patch@example.invalid")
    await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    const id = (await getSession())?.profileId
    expect(id).toBeTruthy()

    const patched = await profilesPATCH(
      jsonRequest(`/api/v1/profiles/${id}`, "PATCH", {
        ...listing,
        one_liner: "Edited after persist miss.",
      }),
      { params: Promise.resolve({ id: id! }) },
    )
    expect(patched.status).toBe(503)
    const body = (await patched.json()) as { error?: string }
    expect(body.error).toMatch(/lasting copy/i)
  })

  it("returns 503 on PATCH outcome", async () => {
    await confirmEmail("persist-outcome@example.invalid")
    await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    const id = (await getSession())?.profileId
    expect(id).toBeTruthy()

    const patched = await profilesPATCH(
      jsonRequest(`/api/v1/profiles/${id}`, "PATCH", { joint_application: "yes" }),
      { params: Promise.resolve({ id: id! }) },
    )
    expect(patched.status).toBe(503)
    const body = (await patched.json()) as { error?: string }
    expect(body.error).toMatch(/lasting copy/i)
  })
})
