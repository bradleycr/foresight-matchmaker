import { afterEach, describe, expect, it } from "vitest"
import { blobImportEnabled, durableEnabled, preferredBackend } from "./durable-store"

const KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_IMPORT",
  "VERCEL",
  "DURABLE_PROFILES",
] as const

const snapshot = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of KEYS) {
    const value = snapshot[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function clear() {
  for (const key of KEYS) delete process.env[key]
}

describe("durable store selection", () => {
  it("is off when nothing is configured", () => {
    clear()
    expect(durableEnabled()).toBe(false)
    expect(preferredBackend()).toBeNull()
  })

  it("prefers Supabase over Blob on Vercel", () => {
    clear()
    process.env.VERCEL = "1"
    process.env.SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
    process.env.BLOB_READ_WRITE_TOKEN = "blob"
    expect(durableEnabled()).toBe(true)
    expect(preferredBackend()).toBe("supabase")
  })

  it("accepts NEXT_PUBLIC_SUPABASE_URL as the project URL", () => {
    clear()
    process.env.VERCEL = "1"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
    expect(preferredBackend()).toBe("supabase")
  })

  it("uses Blob when Supabase is absent", () => {
    clear()
    process.env.VERCEL = "1"
    process.env.BLOB_READ_WRITE_TOKEN = "blob"
    expect(preferredBackend()).toBe("blob")
  })

  it("keeps Blob import off unless an operator opts in", () => {
    clear()
    process.env.BLOB_READ_WRITE_TOKEN = "blob"
    expect(blobImportEnabled()).toBe(false)
    process.env.BLOB_IMPORT = "1"
    expect(blobImportEnabled()).toBe(true)
  })

  it("stays off locally unless DURABLE_PROFILES is set", () => {
    clear()
    process.env.SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
    expect(durableEnabled()).toBe(false)
    process.env.DURABLE_PROFILES = "1"
    expect(durableEnabled()).toBe(true)
    expect(preferredBackend()).toBe("supabase")
  })
})
