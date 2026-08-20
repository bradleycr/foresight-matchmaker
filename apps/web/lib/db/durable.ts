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
}

/** GDPR erasure — drop both the document and the email pointer. */
export async function forgetListing(id: string, email: string): Promise<void> {
  if (!durableEnabled()) return
  await del([profilePath(id), emailPath(email)])
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
 * Fill the local cache from Blob. Debounced per isolate so a directory page
 * of 50 people does not list the store on every card render.
 */
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
