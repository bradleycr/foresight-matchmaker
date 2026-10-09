/**
 * One-shot: a few AI Safety Berlin demo listings for partner pitches.
 * They stay invisible on the Recoding Medicine public site until the
 * demo unlock cookie (or a preview deploy) makes that programme visible.
 *
 * Prints counts only — never emails.
 */
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const TABLE = "durable_kv"
const PREFIX = "matchmaker/profiles/"

type Demo = {
  slug: string
  org_name: string
  one_liner: string
  kind: "individual" | "ai_team"
  org_type: string
}

const DEMOS: Demo[] = [
  {
    slug: "asb-demo-alignment-lab",
    org_name: "Alignment Lab Berlin",
    one_liner: "Small team working on scalable oversight and evals for frontier models.",
    kind: "ai_team",
    org_type: "research_institute",
  },
  {
    slug: "asb-demo-mara-koenig",
    org_name: "Mara König",
    one_liner: "Independent researcher on agentic systems and misuse monitoring.",
    kind: "individual",
    org_type: "individual",
  },
  {
    slug: "asb-demo-treuhand-compute",
    org_name: "Treuhand Compute Collective",
    one_liner: "Shared GPU access and eval harnesses for Berlin AIS researchers.",
    kind: "ai_team",
    org_type: "nonprofit",
  },
  {
    slug: "asb-demo-jules-okafor",
    org_name: "Jules Okafor",
    one_liner: "Policy researcher focused on EU AI Act compliance for open models.",
    kind: "individual",
    org_type: "individual",
  },
  {
    slug: "asb-demo-spree-evals",
    org_name: "Spree Evals",
    one_liner: "Building private eval suites for biosecurity and cyber risk.",
    kind: "ai_team",
    org_type: "startup",
  },
]

function profileOf(demo: Demo) {
  const now = new Date().toISOString()
  const id = randomUUID()
  return {
    id,
    slug: demo.slug,
    kind: demo.kind,
    challenge_id: "ai_safety_berlin",
    org_name: demo.org_name,
    org_type: demo.org_type,
    country: "DE",
    eligible_hq: true,
    partner_only: false,
    one_liner: demo.one_liner,
    summary: `${demo.one_liner} Demo listing for the AI Safety Berlin matchmaker preview — not a real applicant.`,
    languages: ["en", "de"],
    looking_for: ["join_team", "individual_expert"],
    application_status: "intend_to_apply",
    parallel_public_funding: "no",
    attending: ["asb_coworking", "asb_lunch"],
    open_to_intros: true,
    visibility: "authenticated_only",
    contact_name: demo.org_name,
    contact_email: `${demo.slug}@asb-demo.invalid`,
    contact_role: demo.kind === "individual" ? "Independent" : "Organiser",
    methods: ["privacy_tech", "foundation_models"],
    application_target: ["clinical_decision_support"],
    domain_expertise: ["multi_domain"],
    clinical_partner: "not_needed",
    regulatory_experience: ["gdpr_dpia"],
    compute: "cloud_budget",
    privacy_capability: ["differential_privacy"],
    team_size: demo.kind === "individual" ? "1" : "2_5",
    track_record: [],
    data_needs: {
      modality: [],
      disease_area: [],
      linkage_required: [],
      standards_preferred: [],
    },
    created_at: now,
    updated_at: now,
    completeness: 70,
  }
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // Skip if any asb-demo slug already exists
  const { data: existing, error: listErr } = await supabase
    .from(TABLE)
    .select("key,value")
    .like("key", `${PREFIX}%`)
    .limit(1000)
  if (listErr) throw listErr

  let already = 0
  for (const row of existing ?? []) {
    const value = typeof row.value === "string" ? JSON.parse(row.value) : row.value
    if (value?.slug?.startsWith("asb-demo-")) already += 1
  }
  if (already > 0) {
    console.log(JSON.stringify({ ok: true, skipped: true, already }, null, 2))
    return
  }

  let written = 0
  for (const demo of DEMOS) {
    const profile = profileOf(demo)
    const { error } = await supabase.from(TABLE).upsert(
      { key: `${PREFIX}${profile.id}.json`, value: profile, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
    if (error) throw error
    written += 1
  }
  console.log(JSON.stringify({ ok: true, written, programme: "ai_safety_berlin" }, null, 2))
}

main().catch((err) => {
  console.error(String(err))
  process.exit(1)
})
