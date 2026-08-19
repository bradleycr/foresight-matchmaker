import {
  KIND,
  LOOKING_FOR,
  LANGUAGE,
  METHODS,
  APPLICATION_TARGET,
  DISEASE_AREA,
  MODALITY,
  PRIVACY_CAPABILITY,
  type Kind,
} from "@rmm/schema"
import type { PrefillProposal } from "@/lib/llm/prefill"

/**
 * Generative UI for Remmy intake: the model names a vocabulary, never the
 * option list. We hydrate tappable chips from the schema so a person can
 * fill modality / disease / methods without typing 24 enum labels.
 */

export const ASK_IDS = [
  "kind",
  "looking_for",
  "languages",
  "methods",
  "application_target",
  "domain_expertise",
  "privacy_capability",
  "modality",
  "disease_area",
] as const

export type AskId = (typeof ASK_IDS)[number]

export interface AskCatalogEntry {
  id: AskId
  /** i18n group for enumLabel() */
  group: string
  options: readonly string[]
  multi: boolean
  labelKey: string
}

export const ASK_CATALOG: Record<AskId, AskCatalogEntry> = {
  kind: { id: "kind", group: "kind", options: KIND, multi: false, labelKey: "field.kind" },
  looking_for: {
    id: "looking_for",
    group: "looking_for",
    options: LOOKING_FOR,
    multi: true,
    labelKey: "field.looking_for",
  },
  languages: {
    id: "languages",
    group: "language",
    options: LANGUAGE,
    multi: true,
    labelKey: "field.languages",
  },
  methods: { id: "methods", group: "methods", options: METHODS, multi: true, labelKey: "field.methods" },
  application_target: {
    id: "application_target",
    group: "application_target",
    options: APPLICATION_TARGET,
    multi: true,
    labelKey: "field.application_target",
  },
  domain_expertise: {
    id: "domain_expertise",
    group: "disease_area",
    options: DISEASE_AREA,
    multi: true,
    labelKey: "field.domain_expertise",
  },
  privacy_capability: {
    id: "privacy_capability",
    group: "privacy_capability",
    options: PRIVACY_CAPABILITY,
    multi: true,
    labelKey: "field.privacy_capability",
  },
  modality: { id: "modality", group: "modality", options: MODALITY, multi: true, labelKey: "field.modality" },
  disease_area: {
    id: "disease_area",
    group: "disease_area",
    options: DISEASE_AREA,
    multi: true,
    labelKey: "field.disease_area",
  },
}

const ASK_SET = new Set<string>(ASK_IDS)

export function isAskId(value: unknown): value is AskId {
  return typeof value === "string" && ASK_SET.has(value)
}

const GAP_TO_ASK: Record<string, AskId> = {
  looking_for: "looking_for",
  languages: "languages",
  methods: "methods",
  application_target: "application_target",
  domain_expertise: "domain_expertise",
  privacy_capability: "privacy_capability",
  datasets: "modality",
}

/** Gaps to walk past when inferring chips (typed on the form, or not vocab). */
const SKIP_PAST = new Set(["contact_name", "contact_email", "website", "attending", "compute_scale"])

/** Free-text identity — chips would interrupt the name/summary question. */
const TEXT_STOP = new Set(["org_name", "one_liner", "summary"])

function firstDataset(profile: Record<string, unknown> | null): {
  modality: unknown[]
  disease_area: unknown[]
} | null {
  const rows = profile?.datasets
  if (!Array.isArray(rows) || rows.length === 0) return null
  const row = rows[0] as { modality?: unknown; disease_area?: unknown }
  return {
    modality: Array.isArray(row.modality) ? row.modality : [],
    disease_area: Array.isArray(row.disease_area) ? row.disease_area : [],
  }
}

function datasetAsk(profile: Record<string, unknown> | null): AskId {
  const ds = firstDataset(profile)
  if (!ds || ds.modality.length === 0) return "modality"
  if (ds.disease_area.length === 0) return "disease_area"
  return "modality"
}

/**
 * Prefer the model's `ask`. If it forgot, show chips only when the next
 * real gap is a vocabulary — never while they still owe a name or summary.
 */
export function resolveAsk(
  llmAsk: unknown,
  openGaps: readonly string[],
  profile: Record<string, unknown> | null,
): AskId | null {
  if (isAskId(llmAsk)) return llmAsk

  const next = openGaps.find((g) => !SKIP_PAST.has(g))
  if (!next || TEXT_STOP.has(next)) return null
  if (next === "datasets") return datasetAsk(profile)
  return GAP_TO_ASK[next] ?? null
}

function emptyProposal(): PrefillProposal {
  return {
    languages: [],
    looking_for: [],
    methods: [],
    application_target: [],
    domain_expertise: [],
    regulatory_experience: [],
    privacy_capability: [],
    track_record: [],
    datasets: [],
  }
}

function asKind(values: string[]): Kind | undefined {
  const v = values[0]
  return v && (KIND as readonly string[]).includes(v) ? (v as Kind) : undefined
}

/**
 * Chip picks → a tiny proposal the form merger already understands.
 * AI kinds map disease chips to domain expertise, not "data I need".
 * Data holders map modality / disease onto the dataset row.
 */
export function proposalFromAsk(
  ask: AskId,
  values: string[],
  kind: Kind | undefined,
): PrefillProposal {
  const p = emptyProposal()
  const holder = kind === "data_holder" || kind === "consortium"

  switch (ask) {
    case "kind": {
      const k = asKind(values)
      return k ? { ...p, kind: k } : p
    }
    case "looking_for":
      return { ...p, looking_for: values as PrefillProposal["looking_for"] }
    case "languages":
      return { ...p, languages: values as PrefillProposal["languages"] }
    case "methods":
      return { ...p, methods: values as PrefillProposal["methods"] }
    case "application_target":
      return { ...p, application_target: values as PrefillProposal["application_target"] }
    case "domain_expertise":
      return { ...p, domain_expertise: values as PrefillProposal["domain_expertise"] }
    case "privacy_capability":
      return { ...p, privacy_capability: values as PrefillProposal["privacy_capability"] }
    case "modality":
      if (holder) {
        return {
          ...p,
          datasets: [{ name: undefined, modality: values as PrefillProposal["datasets"][number]["modality"], disease_area: [], linkage: [], standards: [] }],
        }
      }
      return {
        ...p,
        data_needs: {
          modality: values as NonNullable<PrefillProposal["data_needs"]>["modality"],
          disease_area: [],
          linkage_required: [],
          standards_preferred: [],
        },
      }
    case "disease_area":
      if (holder) {
        return {
          ...p,
          datasets: [
            {
              name: undefined,
              modality: [],
              disease_area: values as PrefillProposal["datasets"][number]["disease_area"],
              linkage: [],
              standards: [],
            },
          ],
        }
      }
      return {
        ...p,
        data_needs: {
          modality: [],
          disease_area: values as NonNullable<PrefillProposal["data_needs"]>["disease_area"],
          linkage_required: [],
          standards_preferred: [],
        },
      }
  }
}
