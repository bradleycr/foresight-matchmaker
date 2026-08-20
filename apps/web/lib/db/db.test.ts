import { describe, it, expect, beforeAll } from "vitest"

// An isolated in-memory database per test run — no disk state, no cleanup.
process.env.DATABASE_PATH = ":memory:"

import { saveProfile, listPublicProfiles, getProfilesByEmail, getProfileById, deleteProfile } from "./profiles"
import { isSyntheticContactEmail, purgeSyntheticProfiles } from "./purge-core"
import { getShortlist, getAllCachedMatches } from "./matches"
import { requestIntro, listIntrosFor, rateLimitPer24h } from "./intros"
import { listEvents } from "./events"
import { issueToken } from "../auth/tokens"
import { getDb } from "./client"
import { authTokens, matches as matchesTable, intros as introsTable } from "./schema"
import { eq, or } from "drizzle-orm"

const PRIVATE_KEYS = ["contact_name", "contact_role", "governance_notes"]

function makeDataHolder(n: number, overrides: Record<string, unknown> = {}) {
  return saveProfile(
    {
      kind: "data_holder",
      org_name: `Holder ${n}`,
      slug: `holder-${n}`,
      org_type: "hospital",
      country: "DE",
      one_liner: "A hospital imaging archive.",
      summary: "Synthetic test data holder.",
      languages: ["en"],
      looking_for: ["ai_partner"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["webinar_2026_08_20"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Secret Person",
      contact_email: `holder-${n}@example.org`,
      contact_role: "DPO",
      datasets: [
        {
          name: "Public cohort",
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
          governance_notes: "SECRET governance detail",
        },
        {
          name: "Hidden cohort",
          modality: ["genomics"],
          disease_area: ["rare_disease"],
          n_subjects: "1k_10k",
          volume: "lt_100gb",
          longitudinal: false,
          annotation: "none",
          linkage: ["none"],
          standards: ["vcf"],
          readiness: "raw",
          consent_basis: "pseudonymised",
          access_model: "secure_processing_environment_only",
          data_can_leave_institution: "no",
          ethics_approval: "in_progress",
          publicly_describable: false,
        },
      ],
      ...overrides,
    },
    { isNew: true },
  )
}

function makeAiTeam(n: number, overrides: Record<string, unknown> = {}) {
  return saveProfile(
    {
      kind: "ai_team",
      org_name: `Team ${n}`,
      slug: `team-${n}`,
      org_type: "startup",
      country: "FR",
      one_liner: "An imaging AI team.",
      summary: "Synthetic test AI team.",
      languages: ["en"],
      looking_for: ["dataset_access"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["webinar_2026_08_20"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Secret Engineer",
      contact_email: `team-${n}@example.org`,
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

function makeIndividual(n: number, overrides: Record<string, unknown> = {}) {
  return saveProfile(
    {
      kind: "individual",
      org_name: `Expert ${n}`,
      slug: `expert-${n}`,
      org_type: "individual",
      country: "NL",
      one_liner: "An independent imaging expert.",
      summary: "Synthetic test individual.",
      languages: ["en"],
      looking_for: ["join_team"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: [],
      open_to_intros: true,
      visibility: "public",
      contact_name: `Expert ${n}`,
      contact_email: `expert-${n}@example.org`,
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
      ...overrides,
    },
    { isNew: true },
  )
}

function makeConsortium(n: number, overrides: Record<string, unknown> = {}) {
  return saveProfile(
    {
      kind: "consortium",
      org_name: `Consortium ${n}`,
      slug: `consortium-${n}`,
      org_type: "university",
      country: "SE",
      one_liner: "A mixed data-and-AI consortium.",
      summary: "Synthetic test consortium.",
      languages: ["en"],
      looking_for: ["clinical_partner"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: [],
      open_to_intros: true,
      visibility: "public",
      contact_name: `Lead ${n}`,
      contact_email: `consortium-${n}@example.org`,
      datasets: [
        {
          name: "Consortium cohort",
          modality: ["genomics"],
          disease_area: ["immunology"],
          n_subjects: "1k_10k",
          volume: "100gb_1tb",
          longitudinal: false,
          annotation: "partial",
          linkage: ["outcomes"],
          standards: ["vcf"],
          readiness: "partially_curated",
          consent_basis: "broad_consent",
          access_model: "dua_required",
          data_can_leave_institution: "yes",
          ethics_approval: "approved",
          publicly_describable: true,
        },
      ],
      methods: ["foundation_models"],
      application_target: ["biomarker_discovery"],
      domain_expertise: ["immunology"],
      clinical_partner: "need",
      regulatory_experience: ["gdpr_dpia"],
      compute: "own_cluster",
      privacy_capability: ["federated_capable"],
      team_size: "6_15",
      track_record: [],
      data_needs: {
        modality: ["ehr_structured"],
        disease_area: ["immunology"],
        linkage_required: [],
        standards_preferred: [],
      },
      still_seeking: ["clinical_partner"],
      ...overrides,
    },
    { isNew: true },
  )
}

let holder: ReturnType<typeof makeDataHolder>
let team: ReturnType<typeof makeAiTeam>

beforeAll(() => {
  holder = makeDataHolder(1)
  team = makeAiTeam(1)
  makeDataHolder(2, { visibility: "hidden", slug: "holder-hidden" })
})

describe("public directory redaction (the API payload)", () => {
  it("contains no private key anywhere in the serialised payload", () => {
    const json = JSON.stringify(listPublicProfiles())
    for (const key of PRIVATE_KEYS) {
      expect(json).not.toContain(`"${key}"`)
    }
    expect(json).not.toContain("Secret Person")
    expect(json).not.toContain("SECRET governance detail")
  })

  it("excludes hidden profiles entirely", () => {
    const slugs = listPublicProfiles().map((p) => p.slug)
    expect(slugs).not.toContain("holder-hidden")
  })

  it("drops datasets flagged not publicly describable", () => {
    const entry = listPublicProfiles().find((p) => p.id === holder.id) as { datasets: Array<{ name: string }> }
    expect(entry.datasets.map((d) => d.name)).toEqual(["Public cohort"])
  })
})

describe("derived fields are server-owned", () => {
  it("derives eligible_hq from the country, ignoring client input", () => {
    const us = makeDataHolder(3, { country: "US", eligible_hq: true, slug: "holder-us" })
    expect(us.eligible_hq).toBe(false)
    expect(holder.eligible_hq).toBe(true)
  })

  it("indexes profiles by lowercased contact email", () => {
    expect(getProfilesByEmail("HOLDER-1@EXAMPLE.ORG")).toHaveLength(1)
  })
})

describe("match cache", () => {
  it("recomputes on write and serves a ranked shortlist", () => {
    const shortlist = getShortlist(holder.id)
    expect(shortlist.length).toBeGreaterThan(0)
    expect(shortlist[0].otherId).toBe(team.id)
    expect(shortlist[0].score).toBeGreaterThanOrEqual(35)
  })
})

describe("intro flow", () => {
  it("records an emailed introduction immediately", () => {
    const requested = requestIntro(team.id, holder.id, "Shall we apply together?")
    expect(requested.ok).toBe(true)
    if (!requested.ok) return
    expect(requested.intro.state).toBe("emailed")
    expect(listIntrosFor(team.id).find((i) => i.id === requested.intro.id)?.state).toBe("emailed")
  })

  it("rejects a second intro for the same pair", () => {
    const again = requestIntro(team.id, holder.id, "Again?")
    expect(again).toEqual({ ok: false, error: "already_contacted" })
  })

  it("rejects a self-intro", () => {
    expect(requestIntro(team.id, team.id, "Hi me")).toEqual({ ok: false, error: "self_intro" })
  })

  it("rate-limits at 5 outbound requests per 24h", () => {
    // The emailed intro above already counts as 1 outbound for `team`.
    for (let i = 0; i < 4; i++) {
      const target = makeDataHolder(10 + i, { slug: `holder-rl-${i}` })
      expect(requestIntro(team.id, target.id, `Request ${i}`).ok).toBe(true)
    }
    const oneMore = makeDataHolder(20, { slug: "holder-rl-final" })
    expect(requestIntro(team.id, oneMore.id, "Too many")).toEqual({ ok: false, error: "rate_limited" })
  })

  it("honours RATE_LIMIT_PER_24H from the environment", () => {
    const original = process.env.RATE_LIMIT_PER_24H
    process.env.RATE_LIMIT_PER_24H = "2"
    try {
      expect(rateLimitPer24h()).toBe(2)
      const sender = makeAiTeam(30, { slug: "rl-config-team" })
      const t1 = makeDataHolder(30, { slug: "rl-config-holder-1" })
      const t2 = makeDataHolder(31, { slug: "rl-config-holder-2" })
      const t3 = makeDataHolder(32, { slug: "rl-config-holder-3" })
      expect(requestIntro(sender.id, t1.id, "One").ok).toBe(true)
      expect(requestIntro(sender.id, t2.id, "Two").ok).toBe(true)
      expect(requestIntro(sender.id, t3.id, "Three")).toEqual({ ok: false, error: "rate_limited" })
    } finally {
      if (original === undefined) delete process.env.RATE_LIMIT_PER_24H
      else process.env.RATE_LIMIT_PER_24H = original
    }
  })

  it("falls back to 5 when the environment value is unset or invalid", () => {
    const original = process.env.RATE_LIMIT_PER_24H
    for (const invalid of [undefined, "", "0", "-3", "not-a-number"]) {
      if (invalid === undefined) delete process.env.RATE_LIMIT_PER_24H
      else process.env.RATE_LIMIT_PER_24H = invalid
      expect(rateLimitPer24h()).toBe(5)
    }
    if (original === undefined) delete process.env.RATE_LIMIT_PER_24H
    else process.env.RATE_LIMIT_PER_24H = original
  })
})

describe("GDPR profile erasure", () => {
  it("hard-deletes the profile and every record that names it", () => {
    const doomed = makeAiTeam(99, {
      slug: "doomed-team",
      contact_email: "doomed@example.org",
      org_name: "Doomed Team",
    })
    const peer = makeDataHolder(99, { slug: "doomed-peer" })
    expect(requestIntro(doomed.id, peer.id, "Please erase me after.").ok).toBe(true)
    issueToken("doomed@example.org", doomed.id)

    expect(deleteProfile(doomed.id)).toBe(true)
    expect(getProfileById(doomed.id)).toBeNull()
    expect(listPublicProfiles().some((p) => p.id === doomed.id)).toBe(false)

    const db = getDb()
    expect(
      db
        .select()
        .from(matchesTable)
        .where(or(eq(matchesTable.subjectId, doomed.id), eq(matchesTable.otherId, doomed.id)))
        .all(),
    ).toHaveLength(0)
    expect(
      db
        .select()
        .from(introsTable)
        .where(or(eq(introsTable.fromId, doomed.id), eq(introsTable.toId, doomed.id)))
        .all(),
    ).toHaveLength(0)
    expect(db.select().from(authTokens).where(eq(authTokens.email, "doomed@example.org")).all()).toHaveLength(0)

    // Event rows for this actor are anonymised; an erasure crumb remains without PII.
    const attributed = listEvents().filter((e) => e.actorId === doomed.id)
    expect(attributed).toHaveLength(0)
    const erasure = listEvents().filter((e) => e.type === "profile_deleted")
    expect(erasure.length).toBeGreaterThan(0)
    expect(erasure.every((e) => e.actorId === null && e.payload.erased === true)).toBe(true)

    // Peer still exists; their shortlist no longer points at the erased profile.
    expect(getProfileById(peer.id)).not.toBeNull()
    expect(getShortlist(peer.id).some((m) => m.otherId === doomed.id)).toBe(false)
    expect(getAllCachedMatches().some((m) => m.otherId === doomed.id)).toBe(false)
  })

  it("returns false for an unknown id", () => {
    expect(deleteProfile("no-such-profile")).toBe(false)
  })
})

describe("purge synthetic seed listings", () => {
  it("recognises reserved .invalid contact emails", () => {
    expect(isSyntheticContactEmail("a.voss@example.invalid")).toBe(true)
    expect(isSyntheticContactEmail("bradley@foresight.org")).toBe(false)
    expect(isSyntheticContactEmail("holder-1@example.org")).toBe(false)
  })

  it("removes .invalid contacts and keeps real listings", () => {
    const fake = makeDataHolder(200, {
      slug: "synthetic-holder",
      contact_email: "demo@example.invalid",
    })
    const real = makeAiTeam(200, {
      slug: "real-operator",
      contact_email: "bradley@foresight.org",
    })

    const { removed, kept } = purgeSyntheticProfiles()
    expect(getProfileById(fake.id)).toBeNull()
    expect(getProfileById(real.id)).not.toBeNull()
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(kept).toBeGreaterThanOrEqual(1)
  })
})

describe("every applicant kind on a live directory", () => {
  it("creates and updates an individual listing", () => {
    const person = makeIndividual(1)
    expect(person.kind).toBe("individual")
    expect(getShortlist(person.id)).toEqual(expect.any(Array))

    const edited = saveProfile({
      ...person,
      one_liner: "Updated individual one-liner.",
    })
    expect(edited.id).toBe(person.id)
    expect(edited.one_liner).toBe("Updated individual one-liner.")
    expect(getProfileById(person.id)?.one_liner).toBe("Updated individual one-liner.")
  })

  it("creates and updates a consortium listing", () => {
    const group = makeConsortium(1)
    expect(group.kind).toBe("consortium")
    expect(getShortlist(group.id)).toEqual(expect.any(Array))

    const edited = saveProfile({
      ...group,
      still_seeking: ["ai_partner"],
    })
    expect(edited.kind).toBe("consortium")
    if (edited.kind === "consortium") {
      expect(edited.still_seeking).toEqual(["ai_partner"])
    }
  })

  it("creates a data holder with organisation type Other defined", () => {
    const other = makeDataHolder(50, {
      slug: "holder-other-type",
      org_type: "other",
      org_type_other: "Patient advocacy network",
      looking_for: ["other"],
      looking_for_other: "Regulatory writing",
    })
    expect(other.org_type).toBe("other")
    expect(other.org_type_other).toBe("Patient advocacy network")
    expect(other.looking_for_other).toBe("Regulatory writing")
  })

  it("rejects organisation type Other without a definition", () => {
    expect(() =>
      makeDataHolder(51, {
        slug: "holder-other-blank",
        org_type: "other",
        org_type_other: "",
      }),
    ).toThrow()
  })
})
