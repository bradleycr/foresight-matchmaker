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

const ensureOwnedListing = vi.fn(async (_id: string | null, _email: string) => undefined)
vi.mock("@/lib/db/durable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/durable")>()
  return {
    ...actual,
    ensureOwnedListing,
    persistListing: vi.fn(async () => undefined),
  }
})

const { NextRequest } = await import("next/server")
const { POST: profilesPOST } = await import("@/app/api/v1/profiles/route")
const { createSession, getSession } = await import("@/lib/auth/session")
const { saveProfile } = await import("@/lib/db/profiles")

function jsonRequest(url: string, method: string, body?: unknown): InstanceType<typeof NextRequest> {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  })
}

describe("POST /profiles refuses a second listing", () => {
  beforeEach(() => {
    cookieJar.clear()
    ensureOwnedListing.mockReset()
    ensureOwnedListing.mockResolvedValue(undefined)
  })

  it("hydrates ownership before create and returns already when the mailbox is listed", async () => {
    const existing = saveProfile(
      {
        kind: "individual",
        org_name: "Already Listed",
        slug: "already-listed",
        org_type: "individual",
        country: "SE",
        one_liner: "Already on file.",
        summary: "Synthetic existing listing for duplicate-create guard.",
        languages: ["en"],
        looking_for: ["dataset_access"],
        application_status: "intend_to_apply",
        parallel_public_funding: "no",
        attending: [],
        open_to_intros: true,
        visibility: "public",
        contact_name: "Ada",
        contact_email: "already@example.invalid",
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
        affiliation: "Independent",
      },
      { isNew: true },
    )

    await createSession(null, "already@example.invalid")
    ensureOwnedListing.mockImplementation(async () => {
      // Listing is already in SQLite; ensure is what production uses to refill.
    })

    const res = await profilesPOST(
      jsonRequest("/api/v1/profiles", "POST", {
        kind: "individual",
        org_name: "Should Not Create",
        org_type: "individual",
        country: "SE",
        one_liner: "Duplicate attempt.",
        summary: "Must not mint a second UUID.",
        languages: ["en"],
        looking_for: ["dataset_access"],
        application_status: "intend_to_apply",
        parallel_public_funding: "no",
        attending: [],
        open_to_intros: true,
        visibility: "public",
        contact_name: "Ada",
        contact_email: "ignored@example.invalid",
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
        affiliation: "Independent",
        challenge_id: "recoding_medicine",
      }),
    )

    expect(ensureOwnedListing).toHaveBeenCalledWith(null, "already@example.invalid")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { already?: boolean; profile: { id: string } }
    expect(body.already).toBe(true)
    expect(body.profile.id).toBe(existing.id)
    expect((await getSession())?.profileId).toBe(existing.id)
  })
})
