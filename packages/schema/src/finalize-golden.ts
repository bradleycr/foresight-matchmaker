import { createHash } from "node:crypto"
import { applyDerivedFields } from "./derive"
import { profileSchema, type Profile } from "./profile"

/**
 * Finalise a hand-authored golden fixture into a schema-valid Profile.
 *
 * Golden JSON is deliberately incomplete (no id / timestamps / derived
 * fields, and it may carry a `_test_case` annotation). This is the only
 * place that turns those archetypes into records the matcher and DB accept.
 */

const NOW = "2026-08-01T12:00:00.000Z"

/** Stable UUID v4-shaped id derived from slug — golden rows stay diffable. */
export function goldenId(slug: string): string {
  const hex = createHash("sha256").update(`rmm-golden:${slug}`).digest("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function finalizeGolden(raw: Record<string, unknown>): Profile {
  const { _test_case: _ignored, ...rest } = raw
  const withMeta = {
    ...rest,
    id: typeof rest.id === "string" ? rest.id : goldenId(String(rest.slug)),
    created_at: typeof rest.created_at === "string" ? rest.created_at : NOW,
    updated_at: typeof rest.updated_at === "string" ? rest.updated_at : NOW,
    claimed_at: typeof rest.claimed_at === "string" ? rest.claimed_at : NOW,
    // Placeholders overwritten by applyDerivedFields.
    eligible_hq: false,
    completeness: 0,
    partner_only: rest.partner_only === true,
  }

  const derived = applyDerivedFields(withMeta as Parameters<typeof applyDerivedFields>[0])
  return profileSchema.parse(derived)
}
