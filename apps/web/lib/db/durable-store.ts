import { del, get, list, put } from "@vercel/blob"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Durable key-value behind listings, email pointers, signups, and events.
 *
 * Vercel’s SQLite file lives in `/tmp` and dies with the isolate. This store
 * is the copy that survives. Two backends, same keys:
 *
 *   - Supabase Postgres — preferred. Free project, dashboard you already know.
 *   - Vercel Blob — leftover. Hobby stores suspend; do not rely on it.
 *
 * Keys stay the Blob-era paths (`matchmaker/profiles/{id}.json`, …) so a
 * one-shot import can copy Blob → Supabase without rewriting records.
 *
 * Auth stays magic-link in this app. Supabase is only the durable table.
 */

export type DurableBackend = "supabase" | "blob"

export interface DurableRecord {
  key: string
  value: unknown
}

export interface DurableStore {
  name: DurableBackend
  getJson(key: string): Promise<unknown | null>
  putJson(key: string, body: string): Promise<void>
  remove(keys: string[]): Promise<void>
  listRecords(prefix: string): Promise<DurableRecord[]>
}

const TABLE = "durable_kv"
const PAGE = 1000

const BLOB_PUT = {
  access: "private" as const,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
  cacheControlMaxAge: 60,
}

function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
}

function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/**
 * Same gate as before: on Vercel the durable store is always on when
 * credentials exist. Local/Docker stay on-disk SQLite unless someone
 * opts in — a pulled production token must not ingest laptop tests.
 */
export function durableEnabled(): boolean {
  if (!supabaseConfigured() && !blobConfigured()) return false
  if (process.env.VERCEL) return true
  return process.env.DURABLE_PROFILES === "1" || process.env.DURABLE_PROFILES === "true"
}

export function preferredBackend(): DurableBackend | null {
  if (!durableEnabled()) return null
  if (supabaseConfigured()) return "supabase"
  if (blobConfigured()) return "blob"
  return null
}

declare global {
  var __rmmDurableSupabase: SupabaseClient | undefined
}

function supabase(): SupabaseClient {
  if (globalThis.__rmmDurableSupabase) return globalThis.__rmmDurableSupabase

  const url = supabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("[durable] Supabase is selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing")
  }

  // Service role bypasses RLS. The anon key must never write listings —
  // they contain emails. Table SQL: scripts/supabase-durable.sql
  globalThis.__rmmDurableSupabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return globalThis.__rmmDurableSupabase
}

function parseBody(text: string, key: string): unknown | null {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    console.error("[durable] invalid JSON", { key }, error)
    return null
  }
}

function asValue(raw: unknown, key: string): unknown | null {
  if (raw == null) return null
  if (typeof raw === "string") return parseBody(raw, key)
  if (typeof raw === "object") return raw
  return null
}

function missingTableHint(message: string): string {
  if (!/does not exist|schema cache|42P01/i.test(message)) return message
  return `${message} — paste scripts/supabase-durable.sql into the Supabase SQL editor once.`
}

function fail(action: string, error: { message: string } | null): void {
  if (!error) return
  throw new Error(`[durable] ${action}: ${missingTableHint(error.message)}`)
}

type KvRow = { key: string; value: unknown }

function supabaseStore(): DurableStore {
  return {
    name: "supabase",
    async getJson(key) {
      const { data, error } = await supabase().from(TABLE).select("value").eq("key", key).maybeSingle()
      fail(`read ${key}`, error)
      return asValue(data?.value, key)
    },
    async putJson(key, body) {
      const value = parseBody(body, key)
      if (value === null) throw new Error(`[durable] refusing to store invalid JSON at ${key}`)
      const { error } = await supabase().from(TABLE).upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      )
      fail(`write ${key}`, error)
    },
    async remove(keys) {
      if (keys.length === 0) return
      const { error } = await supabase().from(TABLE).delete().in("key", keys)
      fail("delete", error)
    },
    async listRecords(prefix) {
      const out: DurableRecord[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase()
          .from(TABLE)
          .select("key, value")
          .like("key", `${prefix}%`)
          .order("key")
          .range(from, from + PAGE - 1)
        fail(`list ${prefix}`, error)
        const rows = (data ?? []) as KvRow[]
        for (const row of rows) {
          if (typeof row.key !== "string") continue
          const value = asValue(row.value, row.key)
          if (value !== null) out.push({ key: row.key, value })
        }
        if (rows.length < PAGE) break
      }
      return out
    },
  }
}

async function readBlobJson(pathname: string): Promise<unknown | null> {
  try {
    const result = await get(pathname, { access: "private", useCache: false })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    const text = await new Response(result.stream).text()
    return parseBody(text, pathname)
  } catch (error) {
    console.error("[durable] blob read failed", { pathname }, error)
    return null
  }
}

function blobStore(): DurableStore {
  return {
    name: "blob",
    getJson: readBlobJson,
    async putJson(key, body) {
      await put(key, body, BLOB_PUT)
    },
    async remove(keys) {
      if (keys.length === 0) return
      await del(keys)
    },
    async listRecords(prefix) {
      const out: DurableRecord[] = []
      let cursor: string | undefined
      do {
        const page = await list({ prefix, limit: 1000, cursor })
        await Promise.all(
          page.blobs.map(async (blob) => {
            if (!blob.pathname.endsWith(".json")) return
            const value = await readBlobJson(blob.pathname)
            if (value !== null) out.push({ key: blob.pathname, value })
          }),
        )
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)
      return out
    },
  }
}

let loggedBackend: DurableBackend | null = null

/** Source of truth for this process. Supabase wins when both are configured. */
export function getDurableStore(): DurableStore {
  const backend = preferredBackend()
  if (!backend) {
    throw new Error("[durable] no store configured")
  }
  if (loggedBackend !== backend) {
    loggedBackend = backend
    console.info(`[durable] source of truth: ${backend}`)
  }
  return backend === "supabase" ? supabaseStore() : blobStore()
}

const IMPORT_PREFIXES = [
  "matchmaker/profiles/",
  "matchmaker/emails/",
  "matchmaker/signups/",
  "matchmaker/events/",
] as const

let blobImport: Promise<void> | null = null

/**
 * If Supabase is empty and Blob still has files, copy them once.
 *
 * Recovery after a Hobby Blob suspend: unsuspend long enough for this
 * import, then drop Blob. A suspended store 403s; we log and continue
 * so the site still serves whatever Supabase already has.
 */
export function importBlobIntoSupabase(): Promise<void> {
  if (!durableEnabled() || !supabaseConfigured() || !blobConfigured()) {
    return Promise.resolve()
  }
  if (blobImport) return blobImport

  blobImport = (async () => {
    const dest = supabaseStore()
    const existing = await dest.listRecords("matchmaker/")
    if (existing.length > 0) return

    const source = blobStore()
    let copied = 0
    for (const prefix of IMPORT_PREFIXES) {
      let records: DurableRecord[]
      try {
        records = await source.listRecords(prefix)
      } catch (error) {
        console.error("[durable] blob import list failed", { prefix }, error)
        return
      }
      for (const record of records) {
        try {
          await dest.putJson(record.key, JSON.stringify(record.value))
          copied += 1
        } catch (error) {
          console.error("[durable] blob import put failed", { key: record.key }, error)
        }
      }
    }
    if (copied > 0) {
      console.info(`[durable] imported ${copied} records from Blob into Supabase`)
    }
  })().catch((error) => {
    console.error("[durable] blob → Supabase import failed", error)
  })

  return blobImport
}
