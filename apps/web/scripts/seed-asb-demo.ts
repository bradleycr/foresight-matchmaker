/**
 * One-shot / refresh: AI Safety Berlin demo people for partner pitches.
 * They stay invisible on the Recoding Medicine public site until the
 * demo unlock cookie (or a preview deploy) makes that programme visible.
 *
 * Personas mirror who aisafety.berlin actually hosts at open coworking —
 * technical research, policy/governance, field building, communications,
 * career transitioners, funders — not Recoding Medicine applicant kinds.
 *
 * Upserts by slug so re-running refreshes copy. Prints counts only — never emails.
 */
import { randomUUID } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const TABLE = "durable_kv"
const PREFIX = "matchmaker/profiles/"

type Demo = {
  slug: string
  org_name: string
  affiliation: string
  contact_role: string
  one_liner: string
  summary: string
  looking_for: Array<
    "collaborators" | "career_chat" | "feedback" | "co_host" | "introductions" | "join_team"
  >
  attending: Array<"asb_coworking" | "asb_lunch" | "asb_talks">
}

const DEMOS: Demo[] = [
  {
    slug: "asb-demo-mara-koenig",
    org_name: "Mara König",
    affiliation: "Independent · was MATS",
    contact_role: "Technical AI safety researcher",
    one_liner: "Working on scalable oversight and misuse monitoring for agentic systems.",
    summary:
      "Independent technical researcher (demo listing). Looking for collaborators on eval harnesses and people who have run monitoring in production. Not a real applicant.",
    looking_for: ["collaborators", "feedback"],
    attending: ["asb_coworking", "asb_lunch", "asb_talks"],
  },
  {
    slug: "asb-demo-jules-okafor",
    org_name: "Jules Okafor",
    affiliation: "Think tank · EU AI governance",
    contact_role: "Policy & governance researcher",
    one_liner: "EU AI Act implementation and open-model governance — desk at CIC most Thursdays.",
    summary:
      "Policy researcher (demo listing). Wants intros to technical people who can pressure-test draft guidance, and peers writing on compute thresholds. Not a real applicant.",
    looking_for: ["collaborators", "introductions"],
    attending: ["asb_coworking", "asb_lunch"],
  },
  {
    slug: "asb-demo-lena-vogt",
    org_name: "Lena Vogt",
    affiliation: "Community organiser",
    contact_role: "Field builder",
    one_liner: "Builds local AI safety programmes — workshops, visitor weeks, and onboarding for newcomers.",
    summary:
      "Field builder (demo listing). Looking for co-hosts for talks and people willing to run intro sessions for visitors. Not a real applicant.",
    looking_for: ["co_host", "collaborators"],
    attending: ["asb_coworking", "asb_lunch", "asb_talks"],
  },
  {
    slug: "asb-demo-samir-haddad",
    org_name: "Samir Haddad",
    affiliation: "Freelance · German-language media",
    contact_role: "Communicator / advocate",
    one_liner: "Writes and speaks about AI risk for a general German audience.",
    summary:
      "Communicator (demo listing). Needs researchers who will explain their work in plain language, and feedback on draft explainers. Not a real applicant.",
    looking_for: ["feedback", "introductions"],
    attending: ["asb_lunch", "asb_talks"],
  },
  {
    slug: "asb-demo-nora-weiss",
    org_name: "Nora Weiss",
    affiliation: "Career transition · accountability group",
    contact_role: "Moving into AI safety",
    one_liner: "Leaving software engineering; joining the Thursday accountability group while upskilling.",
    summary:
      "Career switcher (demo listing). Looking for career chat, accountability buddies, and eventually a team or fellowship to join. Not a real applicant.",
    looking_for: ["career_chat", "join_team"],
    attending: ["asb_coworking", "asb_lunch"],
  },
  {
    slug: "asb-demo-eli-brandt",
    org_name: "Eli Brandt",
    affiliation: "Philanthropic scout",
    contact_role: "Funder / programme officer",
    one_liner: "Scouts European technical and governance talent for a small AI-safety grantmaker.",
    summary:
      "Funder persona (demo listing). Open to intros to promising researchers and field builders; not taking cold applications here. Not a real applicant.",
    looking_for: ["introductions", "collaborators"],
    attending: ["asb_coworking", "asb_talks"],
  },
]

function profileOf(demo: Demo, existingId?: string) {
  const now = new Date().toISOString()
  const id = existingId ?? randomUUID()
  return {
    id,
    slug: demo.slug,
    kind: "individual" as const,
    challenge_id: "ai_safety_berlin",
    org_name: demo.org_name,
    org_type: "individual",
    affiliation: demo.affiliation,
    country: "DE",
    eligible_hq: true,
    partner_only: false,
    one_liner: demo.one_liner,
    summary: demo.summary,
    languages: ["en", "de"],
    looking_for: demo.looking_for,
    application_status: "not_applying",
    parallel_public_funding: "no",
    attending: demo.attending,
    open_to_intros: true,
    visibility: "authenticated_only",
    contact_name: demo.org_name,
    contact_email: `${demo.slug}@asb-demo.invalid`,
    contact_role: demo.contact_role,
    methods: [],
    application_target: [],
    domain_expertise: [],
    clinical_partner: "not_needed",
    regulatory_experience: [],
    compute: "unsure",
    privacy_capability: [],
    team_size: "1",
    track_record: [],
    data_needs: {
      modality: [],
      disease_area: [],
      linkage_required: [],
      standards_preferred: [],
    },
    created_at: now,
    updated_at: now,
    completeness: 72,
  }
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: existing, error: listErr } = await supabase
    .from(TABLE)
    .select("key,value")
    .like("key", `${PREFIX}%`)
    .limit(2000)
  if (listErr) throw listErr

  const bySlug = new Map<string, { key: string; id: string }>()
  for (const row of existing ?? []) {
    const value = typeof row.value === "string" ? JSON.parse(row.value) : row.value
    if (typeof value?.slug === "string" && value.slug.startsWith("asb-demo-")) {
      bySlug.set(value.slug, { key: row.key as string, id: value.id as string })
    }
  }

  // Drop old AI-team style demos that are no longer in DEMOS.
  const keep = new Set(DEMOS.map((d) => d.slug))
  let removed = 0
  for (const [slug, row] of bySlug) {
    if (keep.has(slug)) continue
    const { error } = await supabase.from(TABLE).delete().eq("key", row.key)
    if (error) throw error
    bySlug.delete(slug)
    removed += 1
  }

  let written = 0
  for (const demo of DEMOS) {
    const prior = bySlug.get(demo.slug)
    const profile = profileOf(demo, prior?.id)
    const key = prior?.key ?? `${PREFIX}${profile.id}.json`
    const { error } = await supabase.from(TABLE).upsert(
      { key, value: profile, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
    if (error) throw error
    written += 1
  }

  console.log(
    JSON.stringify(
      { ok: true, written, removed, programme: "ai_safety_berlin", people: DEMOS.length },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(String(err))
  process.exit(1)
})
