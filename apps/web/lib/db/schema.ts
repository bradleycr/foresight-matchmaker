import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core"

/**
 * Drizzle table definitions.
 *
 * Design note: the corpus is < 500 records, so the full validated profile is
 * stored as one JSON document in `data` (the Zod schema in @rmm/schema is the
 * source of truth for its shape). The columns alongside it exist purely for
 * indexed lookups — kind filters, email → profile resolution for magic links,
 * admin aggregates. Nothing reads a profile field from a column that also
 * exists in the JSON; the JSON always wins.
 */

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    kind: text("kind").notNull(),
    orgName: text("org_name").notNull(),
    orgType: text("org_type").notNull(),
    country: text("country").notNull(),
    visibility: text("visibility").notNull().default("public"),
    applicationStatus: text("application_status").notNull(),
    completeness: integer("completeness").notNull().default(0),
    contactEmail: text("contact_email").notNull(),
    /** Self-reported KPI: did this profile lead to a joint application? */
    jointApplication: text("joint_application"),
    /** Full profile JSON, validated against @rmm/schema before every write. */
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    claimedAt: text("claimed_at"),
  },
  (t) => [index("idx_profiles_kind").on(t.kind), index("idx_profiles_contact_email").on(t.contactEmail)],
)

/** Pairwise score cache — recomputed whenever either party writes. */
export const matches = sqliteTable(
  "matches",
  {
    subjectId: text("subject_id").notNull(),
    otherId: text("other_id").notNull(),
    score: integer("score").notNull(),
    factors: text("factors").notNull(),
    blockers: text("blockers").notNull(),
    computedAt: text("computed_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.subjectId, t.otherId] }), index("idx_matches_subject").on(t.subjectId, t.score)],
)

/** Introduction emails forwarded off-platform. Legacy rows may still be requested/accepted. */
export const intros = sqliteTable(
  "intros",
  {
    id: text("id").primaryKey(),
    fromId: text("from_id").notNull(),
    toId: text("to_id").notNull(),
    message: text("message").notNull(),
    state: text("state").notNull().default("requested"),
    declineReason: text("decline_reason"),
    createdAt: text("created_at").notNull(),
    respondedAt: text("responded_at"),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_intros_to").on(t.toId), index("idx_intros_from").on(t.fromId)],
)

/** Single-use magic-link tokens, stored hashed. */
export const authTokens = sqliteTable("auth_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  profileId: text("profile_id"),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
})

/**
 * Append-only event log in ordinary use. GDPR erasure anonymises rows
 * attributed to a deleted profile (actor cleared, payload scrubbed) rather
 * than removing the row — funnel counts stay, identifiers do not.
 */
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    actorId: text("actor_id"),
    payload: text("payload").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_events_type").on(t.type)],
)
