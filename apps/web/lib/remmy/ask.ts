import {
  KIND,
  LOOKING_FOR,
  LANGUAGE,
  METHODS,
  APPLICATION_TARGET,
  DISEASE_AREA,
  MODALITY,
  PRIVACY_CAPABILITY,
  attendingChoices,
  type Kind,
} from "@rmm/schema"
import type { PrefillProposal } from "@/lib/llm/prefill"

/**
 * Generative UI for Remmy intake: the model names a vocabulary, never the
 * option list. Chips are shown only when `ask` is an explicit catalog id —
 * we never substitute a different field from leftover form gaps (that is
 * how "which events?" rendered language chips).
 */

export const ASK_IDS = [
  "kind",
  "looking_for",
  "languages",
  "attending",
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
  skipKey?: string
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
  attending: {
    id: "attending",
    group: "attending",
    options: attendingChoices(),
    multi: true,
    labelKey: "field.attending",
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
    skipKey: "remmy.ask_skip_no_domain",
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

/** Vocabularies already committed in this transcript (survives a remount). */
export function answeredAsksFromMessages(
  messages: ReadonlyArray<{ role: string; ask?: string; askDone?: boolean; content?: string }>,
): AskId[] {
  const out: AskId[] = []
  for (const m of messages) {
    if (m.role !== "assistant" || !m.askDone || !isAskId(m.ask)) continue
    if (!out.includes(m.ask)) out.push(m.ask)
  }
  return out
}

/**
 * Chips belong only to the latest Remmy turn. Walking back to an earlier
 * unanswered ask is how "which events?" could still show language chips.
 */
export function activeChipTurn(
  messages: ReadonlyArray<{ role: string; ask?: string; askDone?: boolean; content?: string }>,
): { index: number; ask: AskId } | null {
  if (messages.at(-1)?.role === "user") return null
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== "assistant") continue
    if (m.ask && !m.askDone && isAskId(m.ask)) return { index: i, ask: m.ask }
    return null
  }
  return null
}

/**
 * Chips follow the model's `ask` only. A missing or unknown ask means no
 * chips — never the next open gap (that swapped events for languages).
 */
export function resolveAsk(
  llmAsk: unknown,
  opts: { alreadyHasKind?: boolean; answered?: readonly string[] } = {},
): AskId | null {
  if (!isAskId(llmAsk)) return null
  if (llmAsk === "kind" && opts.alreadyHasKind) return null
  if (opts.answered?.includes(llmAsk)) return null
  return llmAsk
}

/** Drop vocabularies the human already tapped this session from Remmy's gap list. */
export function gapsWithoutAnswered(openGaps: readonly string[], answered: readonly string[]): string[] {
  const skip = new Set(answered)
  return openGaps.filter((g) => {
    if (g === "datasets") return !(skip.has("modality") && skip.has("disease_area"))
    return !skip.has(g)
  })
}

/**
 * Chip commits land in React state on the next paint. Overlay them onto the
 * snapshot we send Remmy so the following turn cannot resurrect a filled field.
 */
export function overlayAskOnProfile(
  profile: Record<string, unknown>,
  ask: AskId,
  values: string[],
): Record<string, unknown> {
  switch (ask) {
    case "kind":
      return { ...profile, kind: values[0] }
    case "looking_for":
    case "languages":
    case "attending":
    case "methods":
    case "application_target":
    case "domain_expertise":
    case "privacy_capability":
      return { ...profile, [ask]: values }
    case "modality":
    case "disease_area":
      return profile
  }
}

function emptyProposal(): PrefillProposal {
  return {
    languages: [],
    looking_for: [],
    still_seeking: [],
    attending: [],
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
    case "attending":
      return { ...p, attending: values as PrefillProposal["attending"] }
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
