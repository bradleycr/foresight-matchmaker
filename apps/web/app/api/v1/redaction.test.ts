import { describe, it, expect, vi, beforeAll, afterEach } from "vitest"

// An isolated in-memory database per test run — no disk state, no cleanup.
process.env.DATABASE_PATH = ":memory:"
process.env.SESSION_SECRET = "test-session-secret-not-for-real-use"
process.env.ADMIN_SECRET = "test-admin-secret-not-for-real-use"

/**
 * `next/headers`'s `cookies()` throws "called outside a request scope"
 * unless it runs inside Next's own request-handling AsyncLocalStorage —
 * which direct handler invocation, by definition, does not provide. Route
 * handlers reach it indirectly through `getSession()` / `isAdmin()`
 * (lib/auth/session.ts, lib/auth/admin.ts).
 *
 * This fakes only the storage, not the auth logic: `createSession()` and
 * `grantAdminCookie()` below are the real, unmodified functions, signing
 * real cookies into this in-memory jar. Every assertion in this file is
 * therefore exercising the actual route handler and the actual cookie
 * signing/verification — the only thing swapped out is where the cookie
 * bytes physically live between requests.
 */
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
const { findSeedDir, seedFromDirectory } = await import("@/lib/db/seed-core")
const { saveProfile, getProfileBySlug } = await import("@/lib/db/profiles")
const { createSession } = await import("@/lib/auth/session")
const { grantAdminCookie } = await import("@/lib/auth/admin")

const { GET: directoryJsonGET } = await import("@/app/api/v1/directory.json/route")
const { GET: profileGET } = await import("@/app/api/v1/profiles/[id]/route")
const { POST: profilesPOST } = await import("@/app/api/v1/profiles/route")
const { POST: introsPOST } = await import("@/app/api/v1/intros/route")
const { PATCH: introPATCH } = await import("@/app/api/v1/intros/[id]/route")
const { GET: metricsGET } = await import("@/app/api/v1/metrics/route")

const PRIVATE_KEYS = ["contact_name", "contact_email", "contact_role", "governance_notes"]

function jsonRequest(url: string, method: string, body?: unknown): InstanceType<typeof NextRequest> {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  })
}

/** Sign in as `profileId` by writing a real session cookie into the fake jar. */
async function signInAs(profileId: string, email: string): Promise<void> {
  cookieJar.clear()
  await createSession(profileId, email)
}

function makeAiTeam(slug: string, overrides: Record<string, unknown> = {}) {
  return saveProfile(
    {
      kind: "ai_team",
      org_name: `Test AI Team ${slug}`,
      slug,
      org_type: "startup",
      country: "FR",
      one_liner: "A test AI team.",
      summary: "Synthetic profile for route-handler tests.",
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
      ...overrides,
    },
    { isNew: true },
  )
}

function makeDataHolder(slug: string, overrides: Record<string, unknown> = {}) {
  return saveProfile(
    {
      kind: "data_holder",
      org_name: `Test Data Holder ${slug}`,
      slug,
      org_type: "hospital",
      country: "DE",
      one_liner: "A test data holder.",
      summary: "Synthetic profile for route-handler tests.",
      languages: ["en"],
      looking_for: ["ai_partner"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["webinar_2026_08_20"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Test Holder Contact",
      contact_email: `${slug}@example.invalid`,
      contact_role: "DPO",
      datasets: [
        {
          name: "Test cohort",
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

let isea: ReturnType<typeof getProfileBySlug>
let hidden: ReturnType<typeof makeDataHolder>
let authOnly: ReturnType<typeof makeDataHolder>

beforeAll(() => {
  // The real golden fixture, purpose-built to catch exactly this leak (see
  // seed/golden/README.md #9): CH-headquartered, one dataset flagged
  // `publicly_describable: false` with a private governance note.
  seedFromDirectory(findSeedDir())
  isea = getProfileBySlug("isea-alpenraum")
  if (!isea) throw new Error("Golden fixture isea-alpenraum did not load — check seed/golden/.")

  hidden = makeDataHolder("test-hidden-profile", { visibility: "hidden" })
  authOnly = makeDataHolder("test-auth-only-profile", { visibility: "authenticated_only" })
})

afterEach(() => {
  cookieJar.clear()
})

describe("GET /api/v1/directory.json — the public contract", () => {
  it("contains no private key, no hidden profile, and no non-public dataset", async () => {
    const res = directoryJsonGET()
    const body = (await res.json()) as { profiles: Array<Record<string, unknown>> }
    const text = JSON.stringify(body)

    for (const key of PRIVATE_KEYS) expect(text).not.toContain(`"${key}"`)
    // The actual private values on the golden fixture, not just the key names.
    expect(text).not.toContain("Küng")
    expect(text).not.toContain("b.kueng@example.invalid")
    expect(text).not.toContain("430 trios")

    expect(body.profiles.some((p) => p.slug === "test-hidden-profile")).toBe(false)
    expect(body.profiles.some((p) => p.slug === "test-auth-only-profile")).toBe(false)

    const entry = body.profiles.find((p) => p.slug === "isea-alpenraum") as { datasets: unknown[] } | undefined
    expect(entry).toBeDefined()
    expect(entry!.datasets).toEqual([])
  })
})

describe("GET /api/v1/profiles/:id — unauthenticated", () => {
  it("returns the redacted public shape for a public profile, dropping the private dataset", async () => {
    const res = await profileGET(jsonRequest(`/api/v1/profiles/${isea!.id}`, "GET"), {
      params: Promise.resolve({ id: isea!.id }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { profile: Record<string, unknown> }
    const text = JSON.stringify(body)

    for (const key of PRIVATE_KEYS) expect(text).not.toContain(`"${key}"`)
    expect(text).not.toContain("Küng")
    expect(body.profile.datasets).toEqual([])
  })

  it("returns 404 for a hidden profile instead of leaking its existence", async () => {
    const res = await profileGET(jsonRequest(`/api/v1/profiles/${hidden!.id}`, "GET"), {
      params: Promise.resolve({ id: hidden!.id }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 401 for an authenticated_only profile with no session", async () => {
    const res = await profileGET(jsonRequest(`/api/v1/profiles/${authOnly!.id}`, "GET"), {
      params: Promise.resolve({ id: authOnly!.id }),
    })
    expect(res.status).toBe(401)
  })

  it("returns the full record, private fields included, to the owner", async () => {
    await signInAs(isea!.id, isea!.contact_email)
    const res = await profileGET(jsonRequest(`/api/v1/profiles/${isea!.id}`, "GET"), {
      params: Promise.resolve({ id: isea!.id }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { profile: Record<string, unknown> }
    expect(body.profile.contact_email).toBe(isea!.contact_email)
  })
})

describe("POST /api/v1/profiles — derived fields are server-owned", () => {
  it("ignores client-supplied eligible_hq and completeness", async () => {
    const res = await profilesPOST(
      jsonRequest("/api/v1/profiles", "POST", {
        kind: "data_holder",
        org_name: "Client-Supplied Fields Test Org",
        org_type: "hospital",
        country: "US", // ineligible HQ — the client claiming otherwise must not matter
        one_liner: "Testing derived-field tampering.",
        summary: "Synthetic profile for route-handler tests.",
        languages: ["en"],
        looking_for: ["ai_partner"],
        application_status: "intend_to_apply",
        parallel_public_funding: "no",
        attending: ["webinar_2026_08_20"],
        open_to_intros: true,
        visibility: "public",
        contact_name: "Tamper Test",
        contact_email: "tamper-test@example.invalid",
        contact_role: "DPO",
        datasets: [
          {
            name: "Test cohort",
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
        // Neither field exists on the write schema (see lib/api/input.ts
        // SERVER_OWNED) — Zod strips them silently. Asserting that here.
        eligible_hq: true,
        completeness: 100,
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { profile: Record<string, unknown> }
    expect(body.profile.eligible_hq).toBe(false)
    expect(body.profile.completeness).not.toBe(100)
  })
})

describe("POST /api/v1/intros then PATCH /api/v1/intros/:id — the double opt-in reveal", () => {
  it("reveals contact details only on acceptance, and nothing on decline", async () => {
    const team = makeAiTeam("test-intro-team")
    const holderAccept = makeDataHolder("test-intro-holder-accept")
    const holderDecline = makeDataHolder("test-intro-holder-decline")

    // 1. The team requests an intro to each holder — no contact info yet.
    await signInAs(team.id, team.contact_email)
    const reqAccept = await introsPOST(jsonRequest("/api/v1/intros", "POST", { to_id: holderAccept.id, message: "Hi" }))
    expect(reqAccept.status).toBe(201)
    const reqAcceptBody = (await reqAccept.json()) as { intro: { id: string; counterpart: Record<string, unknown> } }
    expect(reqAcceptBody.intro.counterpart.contact_email).toBeUndefined()

    const reqDecline = await introsPOST(jsonRequest("/api/v1/intros", "POST", { to_id: holderDecline.id, message: "Hi" }))
    const reqDeclineBody = (await reqDecline.json()) as { intro: { id: string } }

    // 2. Holder A accepts — both sides get the counterpart's contact block.
    await signInAs(holderAccept.id, holderAccept.contact_email)
    const accepted = await introPATCH(jsonRequest(`/api/v1/intros/${reqAcceptBody.intro.id}`, "PATCH", { action: "accepted" }), {
      params: Promise.resolve({ id: reqAcceptBody.intro.id }),
    })
    expect(accepted.status).toBe(200)
    const acceptedBody = (await accepted.json()) as {
      intro: { state: string; counterpart_contact?: { contact_email: string } }
    }
    expect(acceptedBody.intro.state).toBe("accepted")
    expect(acceptedBody.intro.counterpart_contact?.contact_email).toBe(team.contact_email)

    // 3. Holder B declines — the response reveals nothing, not even a hint.
    await signInAs(holderDecline.id, holderDecline.contact_email)
    const declined = await introPATCH(
      jsonRequest(`/api/v1/intros/${reqDeclineBody.intro.id}`, "PATCH", { action: "declined", decline_reason: "other" }),
      { params: Promise.resolve({ id: reqDeclineBody.intro.id }) },
    )
    expect(declined.status).toBe(200)
    const declinedText = JSON.stringify(await declined.json())
    for (const key of PRIVATE_KEYS) expect(declinedText).not.toContain(`"${key}"`)
    expect(declinedText).not.toContain("counterpart_contact")
  })
})

describe("GET /api/v1/metrics — admin only", () => {
  it("rejects without the admin cookie", async () => {
    const res = await metricsGET(jsonRequest("/api/v1/metrics", "GET"))
    expect(res.status).toBe(403)
  })

  it("accepts once the real admin cookie has been granted", async () => {
    cookieJar.clear()
    await grantAdminCookie()
    const res = await metricsGET(jsonRequest("/api/v1/metrics", "GET"))
    expect(res.status).toBe(200)
  })
})
