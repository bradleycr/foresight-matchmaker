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

const { NextRequest } = await import("next/server")
const { POST: requestLink } = await import("@/app/api/v1/auth/request-link/route")
const { POST: claim } = await import("@/app/api/v1/auth/claim/route")
const { POST: profilesPOST } = await import("@/app/api/v1/profiles/route")
const { DELETE: profileDELETE } = await import("@/app/api/v1/profiles/[id]/route")
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
  org_name: "Verified-First Test Lab",
  org_type: "startup",
  country: "DE",
  one_liner: "Confirm email before the form.",
  summary: "Synthetic profile for signup-before-listing tests.",
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

const dataHolderListing = {
  kind: "data_holder" as const,
  org_name: "Switch-Type Imaging Bank",
  org_type: "hospital",
  country: "DE",
  one_liner: "Oncology imaging bank after type switch.",
  summary: "Holder listing created after deleting an AI team profile.",
  languages: ["en"],
  looking_for: ["ai_partner"],
  application_status: "intend_to_apply",
  parallel_public_funding: "no",
  attending: ["webinar_2026_08_20"],
  open_to_intros: true,
  visibility: "authenticated_only",
  contact_name: "Ada",
  contact_email: "ignored@example.invalid",
  contact_role: "Lead",
  datasets: [
    {
      name: "Regional MRI cohort",
      modality: ["imaging_mri"],
      disease_area: ["oncology"],
      n_subjects: "10k_100k",
      volume: "1_10tb",
      longitudinal: true,
      annotation: "expert_labelled",
      linkage: ["outcomes"],
      standards: ["dicom"],
      readiness: "partially_curated",
      consent_basis: "broad_consent",
      access_model: "dua_required",
      data_can_leave_institution: "yes",
      ethics_approval: "approved",
      publicly_describable: true,
    },
  ],
}

beforeEach(() => {
  cookieJar.clear()
})

describe("verify email before listing", () => {
  it("refuses to publish without a confirmed session", async () => {
    const res = await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    expect(res.status).toBe(401)
  })

  it("confirms a new address then binds the listing to it", async () => {
    const requested = await requestLink(
      jsonRequest("/api/v1/auth/request-link", "POST", {
        email: "new-lister@example.invalid",
        next: "/register",
      }),
    )
    expect(requested.status).toBe(200)
    const requestedBody = (await requested.json()) as { claim_link?: string }
    expect(requestedBody.claim_link).toContain("/claim/")
    expect(requestedBody.claim_link).toContain("next=%2Fregister")

    const claimed = await claim(
      jsonRequest("/api/v1/auth/claim", "POST", { token: tokenFromClaimLink(requestedBody.claim_link!) }),
    )
    expect(claimed.status).toBe(200)
    const claimedBody = (await claimed.json()) as { profile_id: string | null }
    expect(claimedBody.profile_id).toBeNull()
    const session = await getSession()
    expect(session?.email).toBe("new-lister@example.invalid")
    expect(session?.profileId).toBeNull()

    const created = await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as { profile: { contact_email?: string }; email_sent: boolean }
    expect(createdBody.profile.contact_email).toBe("new-lister@example.invalid")
    expect(createdBody.email_sent).toBe(false)
    expect((await getSession())?.profileId).toBeTruthy()

    const again = await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    expect(again.status).toBe(200)
    const againBody = (await again.json()) as { already?: boolean }
    expect(againBody.already).toBe(true)
  })

  it("keeps email verified after delete so a new listing can be added without another magic link", async () => {
    const requested = await requestLink(
      jsonRequest("/api/v1/auth/request-link", "POST", {
        email: "switch-type@example.invalid",
        next: "/register",
      }),
    )
    const { claim_link } = (await requested.json()) as { claim_link: string }
    await claim(jsonRequest("/api/v1/auth/claim", "POST", { token: tokenFromClaimLink(claim_link) }))

    const created = await profilesPOST(jsonRequest("/api/v1/profiles", "POST", listing))
    expect(created.status).toBe(201)
    const { profile } = (await created.json()) as { profile: { id: string } }

    const deleted = await profileDELETE(
      jsonRequest(`/api/v1/profiles/${profile.id}`, "DELETE", {
        confirm_org_name: listing.org_name,
      }),
      { params: Promise.resolve({ id: profile.id }) },
    )
    expect(deleted.status).toBe(200)

    const session = await getSession()
    expect(session?.email).toBe("switch-type@example.invalid")
    expect(session?.profileId).toBeNull()

    const recreated = await profilesPOST(jsonRequest("/api/v1/profiles", "POST", dataHolderListing))
    expect(recreated.status).toBe(201)
    const recreatedBody = (await recreated.json()) as { profile: { kind: string } }
    expect(recreatedBody.profile.kind).toBe("data_holder")
  })

  it("issues a real confirmation link when browsing the directory without a listing", async () => {
    const requested = await requestLink(
      jsonRequest("/api/v1/auth/request-link", "POST", {
        email: "browser@example.invalid",
        next: "/directory",
      }),
    )
    expect(requested.status).toBe(200)
    const { claim_link } = (await requested.json()) as { claim_link: string }
    expect(claim_link).toContain("~")
    expect(claim_link).toContain("next=%2Fdirectory")

    const claimed = await claim(jsonRequest("/api/v1/auth/claim", "POST", { token: tokenFromClaimLink(claim_link) }))
    expect(claimed.status).toBe(200)
    const session = await getSession()
    expect(session?.email).toBe("browser@example.invalid")
    expect(session?.profileId).toBeNull()
  })
})
