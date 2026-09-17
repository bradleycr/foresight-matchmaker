import { describe, expect, it, beforeAll } from "vitest"

process.env.DATABASE_PATH = ":memory:"

const { saveProfile, cacheRemoteListings, listProfiles } = await import("./profiles")
const { getShortlist } = await import("./matches")

beforeAll(async () => {
  const { getDb } = await import("./client")
  getDb()
})

function stamp(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function aiTeam() {
  const slug = `fresh-team-${stamp()}`
  return saveProfile(
    {
      kind: "ai_team",
      org_name: `Fresh Lab ${slug}`,
      slug,
      org_type: "startup",
      country: "SE",
      one_liner: "Wants oncology MRI.",
      summary: "Synthetic AI team for door-registration match-cache tests.",
      languages: ["en"],
      looking_for: ["dataset_access"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["event_sept_3"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Fresh Contact",
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

function holder() {
  const slug = `fresh-holder-${stamp()}`
  return saveProfile(
    {
      kind: "data_holder",
      org_name: `Fresh Hospital ${slug}`,
      slug,
      org_type: "hospital",
      country: "SE",
      one_liner: "Oncology MRI cohort.",
      summary: "Synthetic data holder for door-registration match-cache tests.",
      languages: ["en"],
      looking_for: ["ai_partner"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["event_sept_3"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Fresh Person",
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
    },
    { isNew: true },
  )
}

/**
 * Someone registering at the door lands on one Vercel isolate. Every other
 * isolate only ever meets them through a durable pull, which adopts listings
 * without scoring. If that pull leaves the match cache alone, the newcomer is
 * invisible in everyone else's shortlist for the rest of the evening.
 */
describe("shortlists after a durable pull brings in a newcomer", () => {
  it("scores a listing this isolate has never seen before", () => {
    const viewer = aiTeam()
    holder()

    // Warm the viewer's shortlist, the way a first page load would.
    const before = getShortlist(viewer.id)
    expect(before.length).toBeGreaterThan(0)

    // A newcomer registers on a different isolate and reaches this one only
    // through hydrateListings() → cacheRemoteListings().
    const newcomer = holder()
    const adopted = { ...newcomer, id: crypto.randomUUID(), slug: `door-arrival-${stamp()}` }
    cacheRemoteListings([{ profile: adopted, joint_application: null }])
    expect(listProfiles().some((p) => p.id === adopted.id)).toBe(true)

    const after = getShortlist(viewer.id)
    expect(after.map((entry) => entry.otherId)).toContain(adopted.id)
  })

  it("leaves the cache alone when the pull brings nothing new", () => {
    const viewer = aiTeam()
    const peer = holder()
    const first = getShortlist(viewer.id)
    const firstComputedAt = first.find((entry) => entry.otherId === peer.id)?.computedAt

    cacheRemoteListings([{ profile: peer, joint_application: null }])

    const second = getShortlist(viewer.id)
    expect(second.find((entry) => entry.otherId === peer.id)?.computedAt).toBe(firstComputedAt)
  })
})
