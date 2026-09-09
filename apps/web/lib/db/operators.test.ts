import { describe, expect, it } from "vitest"

process.env.DATABASE_PATH = ":memory:"

import {
  findOperatorProfileByEmail,
  installOperatorProfile,
  findSeedDir,
} from "./seed-core"
import { getProfilesByEmail, getProfileBySlug, deleteProfile } from "./profiles"
import { ensureOwnedListing } from "./durable"

describe("operator demo accounts", () => {
  it("finds seed/ so a missing tree fails in CI, not mid-demo", () => {
    expect(findSeedDir()).toMatch(/seed$/)
  })

  it("maps bradley@foresight.org to the foresight-bradley data-holder fixture", () => {
    const profile = findOperatorProfileByEmail("Bradley@Foresight.org")
    expect(profile).not.toBeNull()
    expect(profile!.slug).toBe("foresight-bradley")
    expect(profile!.kind).toBe("data_holder")
    expect(profile!.contact_email).toBe("bradley@foresight.org")
    expect(profile!.claimed_at).toBeTruthy()
  })

  it("installs the fixture so a cold isolate can bind a session to /me", async () => {
    const existing = getProfilesByEmail("bradley@foresight.org")[0]
    if (existing) deleteProfile(existing.id)

    await ensureOwnedListing(null, "bradley@foresight.org")

    const owned = getProfilesByEmail("bradley@foresight.org")[0]
    expect(owned?.slug).toBe("foresight-bradley")
    expect(getProfileBySlug("foresight-bradley")?.id).toBe(owned!.id)

    const fixture = findOperatorProfileByEmail("bradley@foresight.org")!
    // Second install must not invent a twin listing.
    expect(installOperatorProfile(fixture).id).toBe(owned!.id)
  })
})
