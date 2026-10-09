import { CHALLENGES, programmeAutoNudge, type ChallengeId } from "@/lib/challenges/catalog"
import { durableEnabled, getDurableStore } from "@/lib/db/durable-store"

/**
 * Per-programme drip switch. The catalogue is the default; /admin writes
 * an override here so turning Recoding Medicine back on (or silencing a
 * new programme) does not need a deploy.
 */

const SETTINGS_PREFIX = "matchmaker/nudge-settings/"

export interface NudgeProgrammeSetting {
  challenge_id: string
  autoNudge: boolean
  updated_at: string
}

function settingsPath(id: ChallengeId): string {
  return `${SETTINGS_PREFIX}${id}.json`
}

export function resolvedAutoNudge(id: ChallengeId, overrides: ReadonlyMap<string, boolean>): boolean {
  if (overrides.has(id)) return overrides.get(id) === true
  return programmeAutoNudge(id)
}

export async function loadNudgeOverrides(): Promise<Map<string, boolean>> {
  const overrides = new Map<string, boolean>()
  if (!durableEnabled()) return overrides
  try {
    const records = await getDurableStore().listRecords(SETTINGS_PREFIX)
    for (const record of records) {
      const value = record.value as { challenge_id?: unknown; autoNudge?: unknown }
      if (typeof value.challenge_id !== "string" || typeof value.autoNudge !== "boolean") continue
      overrides.set(value.challenge_id, value.autoNudge)
    }
  } catch (error) {
    console.error("[nudge] list settings failed", error)
  }
  return overrides
}

export async function saveNudgeOverride(id: ChallengeId, autoNudge: boolean): Promise<void> {
  if (!durableEnabled()) {
    throw new Error("[nudge] durable store required to save reminder settings")
  }
  const record: NudgeProgrammeSetting = {
    challenge_id: id,
    autoNudge,
    updated_at: new Date().toISOString(),
  }
  await getDurableStore().putJson(settingsPath(id), JSON.stringify(record))
}

export async function autoNudgeByProgramme(): Promise<Record<ChallengeId, boolean>> {
  const overrides = await loadNudgeOverrides()
  const out = {} as Record<ChallengeId, boolean>
  for (const challenge of CHALLENGES) {
    out[challenge.id] = resolvedAutoNudge(challenge.id, overrides)
  }
  return out
}
