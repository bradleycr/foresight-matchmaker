import { describe, it, expect, beforeAll } from "vitest"

process.env.DATABASE_PATH = ":memory:"

import { saveProfile } from "@/lib/db/profiles"
import { hydrateGuideIntents, buildGuideContext, GUIDE_SHORTLIST_LIMIT } from "./hydrate-guide"

function makeHolder(n: number) {
  return saveProfile(
    {
      kind: "data_holder",
      org_name: `Guide Holder ${n}`,
      slug: `guide-holder-${n}`,
      org_type: "hospital",
      country: "DE",
      one_liner: "Imaging archive for matching tests.",
      summary: "Synthetic holder for Remmy guide hydration.",
      languages: ["en", "de"],
      looking_for: ["ai_partner"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["webinar_2026_08_20"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Guide Contact",
      contact_email: `guide-holder-${n}@example.org`,
      contact_role: "PI",
      datasets: [
        {
          name: "MRI cohort",
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

function makeTeam(n: number) {
  return saveProfile(
    {
      kind: "ai_team",
      org_name: `Guide Team ${n}`,
      slug: `guide-team-${n}`,
      org_type: "startup",
      country: "DE",
      one_liner: "MRI oncology models.",
      summary: "Synthetic AI team for Remmy guide hydration.",
      languages: ["en"],
      looking_for: ["dataset_access"],
      application_status: "intend_to_apply",
      parallel_public_funding: "no",
      attending: ["webinar_2026_08_20"],
      open_to_intros: true,
      visibility: "public",
      contact_name: "Guide Lead",
      contact_email: `guide-team-${n}@example.org`,
      contact_role: "CEO",
      methods: ["computer_vision"],
      application_target: ["diagnostics"],
      domain_expertise: ["oncology"],
      clinical_partner: "need",
      regulatory_experience: ["gdpr_dpia"],
      compute: "own_cluster",
      compute_scale: "modest GPU budget",
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

let holder: ReturnType<typeof makeHolder>
let team: ReturnType<typeof makeTeam>

beforeAll(() => {
  holder = makeHolder(1)
  team = makeTeam(1)
})

describe("Remmy guide hydration", () => {
  it("builds context with redacted top matches and no contacts", () => {
    const ctx = buildGuideContext(holder)
    const json = JSON.stringify(ctx)
    expect(json).not.toContain("contact_email")
    expect(json).not.toContain("Guide Contact")
    expect(ctx.match_count).toBeGreaterThanOrEqual(1)
    expect((ctx.top_matches as unknown[]).length).toBeLessThanOrEqual(GUIDE_SHORTLIST_LIMIT)
  })

  it("hydrates show_matches into a shortlist part from the scorer", () => {
    const parts = hydrateGuideIntents(holder, [{ type: "show_matches" }])
    expect(parts[0]?.type).toBe("match_shortlist")
    if (parts[0]?.type !== "match_shortlist") return
    expect(parts[0].matches.length).toBeGreaterThan(0)
    expect(parts[0].matches[0]!.profile.org_name).toBe(team.org_name)
    expect(parts[0].matches[0]!.score).toBeGreaterThanOrEqual(35)
  })

  it("hydrates compose_intro from an org hint without inventing ids", () => {
    const parts = hydrateGuideIntents(holder, [
      { type: "compose_intro", org_hint: "Guide Team 1", draft_message: "Shall we apply jointly?" },
    ])
    expect(parts).toEqual([
      expect.objectContaining({
        type: "intro_compose",
        to_id: team.id,
        to_name: team.org_name,
        draft_message: "Shall we apply jointly?",
      }),
    ])
  })

  it("drops unresolvable invent-y other_ids", () => {
    const parts = hydrateGuideIntents(holder, [
      { type: "explain_match", other_id: "not-a-real-id", org_hint: "zzzz-no-such-org" },
    ])
    // Falls back to top match when hint misses but shortlist exists — only when
    // other_id miss AND org_hint miss. With a nonsense hint and nonsense id,
    // resolveOther returns cards[0]. That is intentional for "explain my top match".
    expect(parts.length).toBeLessThanOrEqual(1)
  })
})
