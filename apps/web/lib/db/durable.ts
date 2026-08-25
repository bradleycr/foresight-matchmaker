import { profileSchema, type Profile } from "@rmm/schema"
import { cacheRemoteListing, getJointApplicationOutcome, getProfileById, getProfilesByEmail, listProfiles } from "./profiles"
import { recomputeMatchesFor } from "./matches"
import { cacheRemoteEvent, type DurableEvent } from "./events"
import {
  durableEnabled,
  getDurableStore,
  importBlobIntoSupabase,
} from "./durable-store"

/**
 * Shared profile store for hosts whose SQLite file is not the source of truth.
 *
 * On Vercel every function instance has its own `/tmp` database. A listing
 * written on instance A is invisible on instance B, which is why `/me` after
 * create used to bounce people to “we could not load your profile”. The
 * durable copy (Supabase, or Blob if Supabase is not configured) is the source of
 * truth: SQLite is a per-instance cache that we refill on miss. Funnel
 * events use the same pattern under `matchmaker/events/`.
 *
 * Local Docker/VM hosts keep using on-disk SQLite and never touch the remote
 * store unless `DURABLE_PROFILES=1` is set (so a pulled token cannot write
 * rehearsal listings into production storage).
 */

export { durableEnabled } from "./durable-store"

const PROFILE_PREFIX = "matchmaker/profiles/"
const EMAIL_PREFIX = "matchmaker/emails/"
const SIGNUP_PREFIX = "matchmaker/signups/"
const EVENT_PREFIX = "matchmaker/events/"
const HYDRATE_DEBOUNCE_MS = 4_000

export interface DurableListing {
  profile: Profile
  joint_application: string | null
}

function profilePath(id: string): string {
  return `${PROFILE_PREFIX}${id}.json`
}

function emailPath(email: string): string {
  return `${EMAIL_PREFIX}${encodeURIComponent(email.toLowerCase())}.json`
}

function signupPath(email: string): string {
  return `${SIGNUP_PREFIX}${encodeURIComponent(email.toLowerCase())}.json`
}

function eventPath(uid: string): string {
  return `${EVENT_PREFIX}${uid}.json`
}

function parseListing(raw: unknown): DurableListing | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  const candidate = "profile" in record ? record.profile : raw
  const parsed = profileSchema.safeParse(candidate)
  if (!parsed.success) return null
  const joint = record.joint_application
  const joint_application =
    joint === "yes" || joint === "no" || joint === "not_yet" ? joint : joint === null ? null : null
  return { profile: parsed.data, joint_application }
}

async function fetchListingById(id: string): Promise<DurableListing | null> {
  return parseListing(await getDurableStore().getJson(profilePath(id)))
}

async function fetchListingByEmail(email: string): Promise<DurableListing | null> {
  const pointer = await getDurableStore().getJson(emailPath(email))
  if (!pointer || typeof pointer !== "object" || !("id" in pointer)) return null
  const id = (pointer as { id: unknown }).id
  if (typeof id !== "string" || !id) return null
  return fetchListingById(id)
}

function adoptListing(listing: DurableListing, recompute: boolean): void {
  cacheRemoteListing(listing.profile, {
    jointApplication: listing.joint_application,
    recompute,
  })
}

/**
 * Write the listing so every other instance can find it. Awaited on the
 * create/update path — returning 201 before this lands is how the stale
 * sign-in screen used to happen.
 */
async function writeListing(profile: Profile): Promise<void> {
  const listing: DurableListing = {
    profile,
    joint_application: getJointApplicationOutcome(profile.id),
  }
  const store = getDurableStore()
  const body = JSON.stringify(listing)
  const pointer = JSON.stringify({ id: profile.id })
  await Promise.all([
    store.putJson(profilePath(profile.id), body),
    store.putJson(emailPath(profile.contact_email), pointer),
  ])
}

export async function persistListing(profile: Profile): Promise<void> {
  if (!durableEnabled()) return
  try {
    await writeListing(profile)
  } catch (error) {
    console.error("[durable] persist retrying", { id: profile.id }, error)
    await writeListing(profile)
  }
  try {
    await persistSignup({
      email: profile.contact_email,
      confirmed_at: profile.claimed_at ?? new Date().toISOString(),
      listed_at: profile.created_at,
      profile_id: profile.id,
      org_name: profile.org_name,
      contact_name: profile.contact_name ?? null,
      contact_role: profile.contact_role ?? null,
      kind: profile.kind,
      org_type: profile.org_type,
      country: profile.country,
      challenge_id: profile.challenge_id ?? "recoding_medicine",
      completeness: profile.completeness,
      visibility: profile.visibility,
      website: profile.website ?? null,
    })
  } catch (error) {
    console.error("[durable] signup copy after listing failed", { id: profile.id }, error)
  }
}

/**
 * Drop the public listing and the email→id pointer.
 *
 * The signup row stays: deleting a listing so someone can re-register must
 * not erase that they requested a magic link. Listing fields on that row
 * are cleared so admin does not keep showing a published profile.
 */
export async function forgetListing(id: string, email: string): Promise<void> {
  if (!durableEnabled()) return
  await getDurableStore().remove([profilePath(id), emailPath(email)])
  try {
    await persistSignup({
      email,
      listed_at: null,
      profile_id: null,
      org_name: null,
      contact_name: null,
      contact_role: null,
      kind: null,
      org_type: null,
      country: null,
      challenge_id: null,
      completeness: null,
      visibility: null,
      website: null,
    })
  } catch (error) {
    console.error("[durable] clear signup listing fields failed", { id, email }, error)
  }
}

export interface SignupRecord {
  email: string
  first_seen_at: string
  last_seen_at: string
  confirmed_at: string | null
  listed_at: string | null
  profile_id: string | null
  org_name: string | null
  contact_name: string | null
  contact_role: string | null
  kind: string | null
  org_type: string | null
  country: string | null
  challenge_id: string | null
  completeness: number | null
  visibility: string | null
  website: string | null
}

export type SignupPatch = { email: string } & Partial<Omit<SignupRecord, "email" | "first_seen_at" | "last_seen_at">>

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function parseSignup(raw: unknown): SignupRecord | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  const email = typeof record.email === "string" ? record.email.toLowerCase() : ""
  if (!email.includes("@")) return null
  const first = asNonEmptyString(record.first_seen_at) ?? asNonEmptyString(record.last_seen_at)
  if (!first) return null
  return {
    email,
    first_seen_at: first,
    last_seen_at: asNonEmptyString(record.last_seen_at) ?? first,
    confirmed_at: asNonEmptyString(record.confirmed_at),
    listed_at: asNonEmptyString(record.listed_at),
    profile_id: asNonEmptyString(record.profile_id),
    org_name: asNonEmptyString(record.org_name),
    contact_name: asNonEmptyString(record.contact_name),
    contact_role: asNonEmptyString(record.contact_role),
    kind: asNonEmptyString(record.kind),
    org_type: asNonEmptyString(record.org_type),
    country: asNonEmptyString(record.country),
    challenge_id: asNonEmptyString(record.challenge_id),
    completeness: asFiniteNumber(record.completeness),
    visibility: asNonEmptyString(record.visibility),
    website: asNonEmptyString(record.website),
  }
}

function keep<T>(incoming: T | undefined, previous: T): T {
  return incoming !== undefined ? incoming : previous
}

/**
 * Read-merge-write so a later magic-link request cannot wipe org fields
 * written when the listing was published.
 */
export async function persistSignup(patch: SignupPatch): Promise<void> {
  if (!durableEnabled()) return
  const email = patch.email.toLowerCase()
  if (!email.includes("@")) return
  const now = new Date().toISOString()
  const store = getDurableStore()
  const existing = parseSignup(await store.getJson(signupPath(email)))
  const next: SignupRecord = {
    email,
    first_seen_at: existing?.first_seen_at ?? now,
    last_seen_at: now,
    confirmed_at: keep(patch.confirmed_at, existing?.confirmed_at ?? null),
    listed_at: keep(patch.listed_at, existing?.listed_at ?? null),
    profile_id: keep(patch.profile_id, existing?.profile_id ?? null),
    org_name: keep(patch.org_name, existing?.org_name ?? null),
    contact_name: keep(patch.contact_name, existing?.contact_name ?? null),
    contact_role: keep(patch.contact_role, existing?.contact_role ?? null),
    kind: keep(patch.kind, existing?.kind ?? null),
    org_type: keep(patch.org_type, existing?.org_type ?? null),
    country: keep(patch.country, existing?.country ?? null),
    challenge_id: keep(patch.challenge_id, existing?.challenge_id ?? null),
    completeness: keep(patch.completeness, existing?.completeness ?? null),
    visibility: keep(patch.visibility, existing?.visibility ?? null),
    website: keep(patch.website, existing?.website ?? null),
  }
  await store.putJson(signupPath(email), JSON.stringify(next))
}

export async function listDurableSignups(): Promise<SignupRecord[]> {
  if (!durableEnabled()) return []
  const out: SignupRecord[] = []
  try {
    const records = await getDurableStore().listRecords(SIGNUP_PREFIX)
    for (const record of records) {
      const rec = parseSignup(record.value)
      if (rec) out.push(rec)
    }
  } catch (error) {
    console.error("[durable] list signups failed", error)
  }
  return out
}

async function fetchSignup(email: string): Promise<SignupRecord | null> {
  return parseSignup(await getDurableStore().getJson(signupPath(email)))
}

async function rewriteEmailPointer(email: string, profileId: string): Promise<void> {
  await getDurableStore().putJson(emailPath(email), JSON.stringify({ id: profileId }))
}

/**
 * Pull one listing into this instance's SQLite. Used when a signed cookie
 * names a profile the local file has never seen.
 *
 * Lookup order: cookie id → email pointer → signup register's profile_id.
 * The register is the durable copy of “this mailbox already listed”, so a
 * missing `matchmaker/emails/…` pointer must not look like a new user.
 */
export async function restoreOwnedProfile(id: string | null, email: string): Promise<void> {
  if (!durableEnabled()) return
  try {
    await importBlobIntoSupabase()
    if (id) {
      const byId = await fetchListingById(id)
      if (byId) {
        adoptListing(byId, true)
        return
      }
    }
    const byEmail = await fetchListingByEmail(email)
    if (byEmail) {
      adoptListing(byEmail, true)
      return
    }
    const signup = await fetchSignup(email)
    if (!signup?.profile_id) return
    const bySignup = await fetchListingById(signup.profile_id)
    if (!bySignup) return
    adoptListing(bySignup, true)
    try {
      await rewriteEmailPointer(email, bySignup.profile.id)
    } catch (error) {
      console.error("[durable] rewrite email pointer failed", { email }, error)
    }
  } catch (error) {
    // A remote blip must not 500 /register or POST /profiles — SQLite can still
    // accept the new listing, and the next request will try the store again.
    console.error("[durable] restore failed", { id, email }, error)
  }
}

/**
 * Make sure this isolate has the listing for a verified mailbox.
 *
 * Restore is the cheap path (one email pointer). If that misses — pointer
 * lost, cold SQLite — hydrate the durable corpus so sign-in still binds
 * the profile they already published.
 */
export async function ensureOwnedListing(id: string | null, email: string): Promise<void> {
  await restoreOwnedProfile(id, email)
  if (id && getProfileById(id)) return
  if (getProfilesByEmail(email).length > 0) return
  await hydrateListings()
}

let lastHydrateAt = 0
let hydrateInflight: Promise<void> | null = null

/**
 * Fill the local cache from the durable store.
 *
 * Cold isolates (empty SQLite) always hydrate. Warm isolates debounce so a
 * burst of public pageviews cannot burn through the remote quota — that is
 * how the Hobby Blob store got suspended.
 */
export async function hydrateListings(opts?: { force?: boolean }): Promise<void> {
  if (!durableEnabled()) return

  const force = opts?.force === true || listProfiles().length === 0
  if (!force) {
    if (hydrateInflight) return hydrateInflight
    if (Date.now() - lastHydrateAt < HYDRATE_DEBOUNCE_MS) return
  } else if (hydrateInflight) {
    await hydrateInflight
  }

  const run = (async () => {
    try {
      await importBlobIntoSupabase()
      const records = await getDurableStore().listRecords(PROFILE_PREFIX)
      for (const record of records) {
        try {
          const listing = parseListing(record.value)
          if (listing) adoptListing(listing, false)
        } catch (error) {
          console.error("[durable] skip unreadable listing", { key: record.key }, error)
        }
      }

      for (const profile of listProfiles()) {
        recomputeMatchesFor(profile.id)
      }
      lastHydrateAt = Date.now()
    } catch (error) {
      console.error("[durable] hydrate failed", error)
    }
  })()

  hydrateInflight = run.finally(() => {
    hydrateInflight = null
  })
  return hydrateInflight
}

function parseEvent(raw: unknown): DurableEvent | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  if (typeof record.uid !== "string" || !record.uid) return null
  if (typeof record.type !== "string" || !record.type) return null
  if (typeof record.createdAt !== "string" || !record.createdAt) return null
  const actorId = typeof record.actorId === "string" ? record.actorId : null
  const payload =
    record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
      ? (record.payload as Record<string, unknown>)
      : {}
  return { uid: record.uid, type: record.type, actorId, payload, createdAt: record.createdAt }
}

/**
 * Dual-write one funnel event. Overwrite by uid so GDPR anonymise can
 * replace the durable copy without leaving the identified payload behind.
 */
export async function persistEvent(event: DurableEvent): Promise<void> {
  if (!durableEnabled()) return
  if (process.env.VITEST) return
  if (!event.uid) return
  const body = JSON.stringify(event)
  try {
    await getDurableStore().putJson(eventPath(event.uid), body)
  } catch (error) {
    console.error("[durable] event persist retrying", { uid: event.uid }, error)
    await getDurableStore().putJson(eventPath(event.uid), body)
  }
}

let lastEventHydrateAt = 0
let eventHydrateInflight: Promise<void> | null = null

/** Pull the durable event log into this instance's SQLite cache. */
export async function hydrateEvents(opts?: { force?: boolean }): Promise<void> {
  if (!durableEnabled()) return

  const force = opts?.force === true
  if (!force) {
    if (eventHydrateInflight) return eventHydrateInflight
    if (Date.now() - lastEventHydrateAt < HYDRATE_DEBOUNCE_MS) return
  } else if (eventHydrateInflight) {
    await eventHydrateInflight
  }

  const run = (async () => {
    try {
      await importBlobIntoSupabase()
      const records = await getDurableStore().listRecords(EVENT_PREFIX)
      for (const record of records) {
        try {
          const event = parseEvent(record.value)
          if (event) cacheRemoteEvent(event)
        } catch (error) {
          console.error("[durable] skip unreadable event", { key: record.key }, error)
        }
      }
      lastEventHydrateAt = Date.now()
    } catch (error) {
      console.error("[durable] hydrate events failed", error)
    }
  })()

  eventHydrateInflight = run.finally(() => {
    eventHydrateInflight = null
  })
  return eventHydrateInflight
}
