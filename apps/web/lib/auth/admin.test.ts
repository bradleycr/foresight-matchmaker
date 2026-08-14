import { afterEach, describe, expect, it } from "vitest"
import { verifyAdminSecret } from "@/lib/auth/admin"

const original = process.env.ADMIN_SECRET

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_SECRET
  else process.env.ADMIN_SECRET = original
})

describe("verifyAdminSecret", () => {
  it("accepts password123 when ADMIN_SECRET is unset", () => {
    delete process.env.ADMIN_SECRET
    expect(verifyAdminSecret("password123")).toBe(true)
    expect(verifyAdminSecret("nope")).toBe(false)
  })

  it("still accepts password123 when ADMIN_SECRET is a different value", () => {
    process.env.ADMIN_SECRET = "rotated-prod-secret"
    expect(verifyAdminSecret("password123")).toBe(true)
    expect(verifyAdminSecret("rotated-prod-secret")).toBe(true)
    expect(verifyAdminSecret("nope")).toBe(false)
  })

  it("trims accidental whitespace around the submitted secret", () => {
    process.env.ADMIN_SECRET = "rotated-prod-secret"
    expect(verifyAdminSecret("  password123  ")).toBe(true)
    expect(verifyAdminSecret("")).toBe(false)
  })
})
