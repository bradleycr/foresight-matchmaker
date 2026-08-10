import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import {
  profileSchema,
  applyDerivedFields,
  toPublicProfile,
  type Profile,
  type PublicProfile,
} from "@rmm/schema"
import { getDb } from "./client"
import { profiles } from "./schema"
import { recomputeMatchesFor } from "./matches"
import { logEvent } from "./events"

/**
 * Profile repository. Every write path funnels through `saveProfile`, which
 * enforces the two invariants the rest of the app relies on:
 *
 *   1. The stored JSON always validates against the Zod schema — bad data
 *      cannot enter the system.
 *   2. Derived fields (`eligible_hq`, `completeness`) are recomputed
 *      server-side on every write. Client-supplied values are ignored.
 *
 * Writes also invalidate + rebuild the match cache for the affected profile.
 */

type ProfileRow = typeof profiles.$inferSelect

function rowToProfile(row: ProfileRow): Profile {
  return JSON.parse(row.data) as Profile
}

function profileToRow(p: Profile): typeof profiles.$inferInsert {
  return {
    id: p.id,
    slug: p.slug,
    kind: p.kind,
    orgName: p.org_name,
    orgType: p.org_type,
    country: p.country,
    visibility: p.visibility,
    applicationStatus: p.application_status,
    completeness: p.completeness,
    contactEmail: p.contact_email.toLowerCase(),
    data: JSON.stringify(p),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    claimedAt: p.claimed_at ?? null,
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listProfiles(): Profile[] {
  return getDb().select().from(profiles).all().map(rowToProfile)
}

export function getProfileById(id: string): Profile | null {
  const row = getDb().select().from(profiles).where(eq(profiles.id, id)).get()
  return row ? rowToProfile(row) : null
}

export function getProfileBySlug(slug: string): Profile | null {
  const row = getDb().select().from(profiles).where(eq(profiles.slug, slug)).get()
  return row ? rowToProfile(row) : null
}

export function getProfilesByEmail(email: string): Profile[] {
  return getDb()
    .select()
    .from(profiles)
    .where(eq(profiles.contactEmail, email.toLowerCase()))
    .all()
    .map(rowToProfile)
}

export function getJointApplicationOutcome(id: string): string | null {
  const row = getDb().select({ v: profiles.jointApplication }).from(profiles).where(eq(profiles.id, id)).get()
  return row?.v ?? null
}

/**
 * Directory listings, redacted through the schema choke point.
 *
 * - Anonymous / public contract (`directory.json`): `visibility: public` only.
 * - Signed-in UI directory: also includes `authenticated_only`.
 * - `hidden` never appears in either.
 */
export function listDirectoryProfiles(opts: { includeAuthenticatedOnly?: boolean } = {}): PublicProfile[] {
  return listProfiles()
    .filter((p) => {
      if (p.visibility === "hidden") return false
      if (p.visibility === "public") return true
      if (p.visibility === "authenticated_only") return opts.includeAuthenticatedOnly === true
      return false
    })
    .map(toPublicProfile)
}

/** Strictly public profiles — the machine-readable `/directory.json` contract. */
export function listPublicProfiles(): PublicProfile[] {
  return listDirectoryProfiles({ includeAuthenticatedOnly: false })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Slugify an org name; suffixes -2, -3… on collision. */
export function slugFor(orgName: string, excludeId?: string): string {
  const base =
    orgName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "profile"

  let slug = base
  for (let n = 2; ; n++) {
    const existing = getProfileBySlug(slug)
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${n}`
  }
}

/**
 * Validate + derive + persist. Accepts anything profile-shaped; throws a
 * ZodError when invalid. Returns the canonical stored profile.
 */
export function saveProfile(input: Record<string, unknown>, opts: { isNew?: boolean } = {}): Profile {
  const now = new Date().toISOString()
  const withMeta = {
    ...input,
    id: opts.isNew ? randomUUID() : input.id,
    created_at: opts.isNew ? now : input.created_at,
    updated_at: now,
    // Zod requires these present; applyDerivedFields overwrites them below.
    eligible_hq: false,
    completeness: 0,
  }

  const derived = applyDerivedFields(withMeta as Parameters<typeof applyDerivedFields>[0])
  const profile = profileSchema.parse(derived)

  const db = getDb()
  const row = profileToRow(profile)
  db.insert(profiles)
    .values(row)
    .onConflictDoUpdate({ target: profiles.id, set: row })
    .run()

  recomputeMatchesFor(profile.id)
  logEvent(opts.isNew ? "profile_created" : "profile_updated", profile.id, { kind: profile.kind })
  return profile
}

export function markClaimed(id: string): void {
  const profile = getProfileById(id)
  if (!profile || profile.claimed_at) return
  const claimed = { ...profile, claimed_at: new Date().toISOString() }
  saveProfile(claimed)
  logEvent("profile_claimed", id, {})
}

export function setJointApplicationOutcome(id: string, outcome: "yes" | "no" | "not_yet"): void {
  getDb().update(profiles).set({ jointApplication: outcome }).where(eq(profiles.id, id)).run()
  logEvent("joint_application_reported", id, { outcome })
}
