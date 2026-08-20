import { del, get, list, put } from "@vercel/blob"
import { profileSchema, type Profile } from "@rmm/schema"
import { cacheRemoteListing, getJointApplicationOutcome, listProfiles } from "./profiles"
import { recomputeMatchesFor } from "./matches"

/**
 * Shared profile store for hosts whose SQLite file is not the source of truth.
 *
 * On Vercel every function instance has its own `/tmp` database. A listing
 * written on instance A is invisible on instance B, which is why `/me` after
 * create used to bounce people to “we could not load your profile”. Blob is
 * the durable copy: SQLite is a per-instance cache that we refill on miss.
 *
 * Local Docker/VM hosts keep using on-disk SQLite and never touch Blob
 * unless `DURABLE_PROFILES=1` is set (so a laptop with a pulled token cannot
 * write rehearsal listings into production storage).
 */

const PROFILE_PREFIX = "matchmaker/profiles/"
const EMAIL_PREFIX = "matchmaker/emails/"
const SIGNUP_PREFIX = "matchmaker/signups/"
const HYDRATE_DEBOUNCE_MS = 4_000

export interface DurableListing {
  profile: Profile
  joint_application: string | null
}

export function durableEnabled(): boolean {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false
  if (process.env.VERCEL) return true
  return process.env.DURABLE_PROFILES === "1" || process.env.DURABLE_PROFILES === "true"
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

const putOpts = {
  access: "private" as const,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
  cacheControlMaxAge: 60,
}

async function readJson(pathname: string): Promise<unknown | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    const text = await new Response(result.stream).text()
    if (!text) return null
    return JSON.parse(text) as unknown
  } catch (error) {
    console.error("[durable] read failed", { pathname }, error)
    return null
  }
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
  return parseListing(await readJson(profilePath(id)))
}

async function fetchListingByEmail(email: string): Promise<DurableListing | null> {
  const pointer = await readJson(emailPath(email))
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
  const body = JSON.stringify(listing)
  const pointer = JSON.stringify({ id: profile.id })
  await Promise.all([
    put(profilePath(profile.id), body, putOpts),
    put(emailPath(profile.contact_email), pointer, putOpts),
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
  await del([profilePath(id), emailPath(email)])
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
  const existing = parseSignup(await readJson(signupPath(email)))
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
  await put(signupPath(email), JSON.stringify(next), putOpts)
}

export async function listDurableSignups(): Promise<SignupRecord[]> {
  if (!durableEnabled()) return []
  const out: SignupRecord[] = []
  try {
    let cursor: string | undefined
    do {
      const page = await list({ prefix: SIGNUP_PREFIX, limit: 1000, cursor })
      await Promise.all(
        page.blobs.map(async (blob) => {
          if (!blob.pathname.endsWith(".json")) return
          const rec = parseSignup(await readJson(blob.pathname))
          if (rec) out.push(rec)
        }),
      )
      cursor = page.hasMore ? page.cursor : undefined
    } while (cursor)
  } catch (error) {
    console.error("[durable] list signups failed", error)
  }
  return out
}

/**
 * Pull one listing into this instance's SQLite. Used when a signed cookie
 * names a profile the local file has never seen.
 */
export async function restoreOwnedProfile(id: string | null, email: string): Promise<void> {
  if (!durableEnabled()) return
  try {
    if (id) {
      const byId = await fetchListingById(id)
      if (byId) {
        adoptListing(byId, true)
        return
      }
    }
    const byEmail = await fetchListingByEmail(email)
    if (byEmail) adoptListing(byEmail, true)
  } catch (error) {
    // A Blob blip must not 500 /register or POST /profiles — SQLite can still
    // accept the new listing, and the next request will try Blob again.
    console.error("[durable] restore failed", { id, email }, error)
  }
}

let lastHydrateAt = 0
let hydrateInflight: Promise<void> | null = null

/**
 * Fill the local cache from Blob.
 *
 * Pass `{ force: true }` on the directory so a listing published a second
 * ago is not skipped because this isolate hydrated an empty corpus earlier.
 */
export async function hydrateListings(opts?: { force?: boolean }): Promise<void> {
  if (!durableEnabled()) return

  const force = opts?.force === true
  if (!force) {
    if (hydrateInflight) return hydrateInflight
    if (Date.now() - lastHydrateAt < HYDRATE_DEBOUNCE_MS) return
  } else if (hydrateInflight) {
    await hydrateInflight
  }

  const run = (async () => {
    try {
      let cursor: string | undefined
      do {
        const page = await list({ prefix: PROFILE_PREFIX, limit: 1000, cursor })
        await Promise.all(
          page.blobs.map(async (blob) => {
            if (!blob.pathname.endsWith(".json")) return
            try {
              const listing = parseListing(await readJson(blob.pathname))
              if (listing) adoptListing(listing, false)
            } catch (error) {
              console.error("[durable] skip unreadable listing", { pathname: blob.pathname }, error)
            }
          }),
        )
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)

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
