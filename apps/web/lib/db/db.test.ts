import { describe, it, expect, beforeAll } from "vitest"

// An isolated in-memory database per test run — no disk state, no cleanup.
process.env.DATABASE_PATH = ":memory:"

import { saveProfile, listPublicProfiles, getProfilesByEmail, getProfileById, deleteProfile } from "./profiles"
import { getShortlist, getAllCachedMatches } from "./matches"
import { requestIntro, listIntrosFor, rateLimitPer24h } from "./intros"
import { listEvents } from "./events"
import { issueToken } from "../auth/tokens"
import { getDb } from "./client"
import { authTokens, matches as matchesTable, intros as introsTable } from "./schema"
import { eq, or } from "drizzle-orm"

const PRIVATE_KEYS = ["contact_name", "contact_email", "contact_role", "governance_notes"]

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
