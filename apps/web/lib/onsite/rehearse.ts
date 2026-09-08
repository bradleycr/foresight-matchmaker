import type { Kind } from "@rmm/schema"
import type { T } from "@/lib/i18n"
import { type OnsiteCitySlug, onsiteCity } from "./cities"
import type { OnsiteCard, OnsiteFeed } from "./types"

/**
 * HDMI rehearsal. Production ignores `?rehearse=`. Local and preview
 * deploys can fill the board before anyone checks in, so the first-arrivals
 * layout can be judged on the actual projector.
 */
const CAST: readonly { org_name: string; kind: Kind; one_liner: string }[] = [
  { org_name: "Charité Data Desk", kind: "data_holder", one_liner: "Hospital cohort ready for a modelling partner." },
  { org_name: "Atlas Models", kind: "ai_team", one_liner: "Foundation models for clinical text." },
  { org_name: "Nordic Biobank Link", kind: "consortium", one_liner: "Cross-border registry looking for an AI lead." },
  { org_name: "Lea Hartmann", kind: "individual", one_liner: "Regulatory scientist joining a Recoding team." },
  { org_name: "Years Clinic", kind: "data_holder", one_liner: "Longitudinal preventive-health measurements." },
  { org_name: "Subspatial", kind: "ai_team", one_liner: "Subcellular spatial models for human biology." },
  { org_name: "MOLIT Institute", kind: "consortium", one_liner: "Personalised-medicine research institute." },
  { org_name: "Robin van de Water", kind: "individual", one_liner: "AI in health, looking for multimodal EHR." },
  { org_name: "Honic", kind: "data_holder", one_liner: "Linkable real-world care data for research." },
  { org_name: "HyprView", kind: "ai_team", one_liner: "Optical imaging for cancer diagnostics." },
  { org_name: "ATScience", kind: "consortium", one_liner: "Researcher-owned infrastructure for science." },
  { org_name: "Sage", kind: "individual", one_liner: "Health, tech, and medicine community builder." },
]

export function parseRehearseCount(raw: string | undefined): number | null {
  if (process.env.VERCEL_ENV === "production") return null
  if (raw == null || raw === "") return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > CAST.length) return null
  return n
}

export function rehearseOnsiteFeed(city: OnsiteCitySlug, count: number, t: T): OnsiteFeed {
  const def = onsiteCity(city)
  const people: OnsiteCard[] = CAST.slice(0, count).map((entry, index) => ({
    id: `rehearse-${index}`,
    slug: `rehearse-${index}`,
    org_name: entry.org_name,
    kind: entry.kind,
    kind_label: t(`enum.kind.${entry.kind}`),
    one_liner: entry.one_liner,
    looking_for: [t("enum.looking_for.ai_partner")],
    arrived_at: new Date(Date.now() - (count - index) * 60_000).toISOString(),
  }))

  const holder = people.find((person) => person.kind === "data_holder")
  const partner = people.find((person) => person.kind !== "data_holder")
  const spotlight =
    holder && partner
      ? { left: holder, right: partner, rotates: people.length > 2 }
      : null

  return {
    city,
    city_label: t(`onsite.city.${city}`),
    date_label: def ? t(`onsite.date.${city}`) : "",
    count: people.length,
    people,
    spotlight,
  }
}
