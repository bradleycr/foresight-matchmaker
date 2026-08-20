import { describe, it, expect, beforeAll, afterAll } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * The one guarantee this directory cannot afford to lose: a profile someone
 * typed in is still there after the process stops.
 *
 * The rest of the suite runs against `:memory:`, which by construction cannot
 * catch a regression in how the file is opened — journal mode, fsync
 * behaviour, or a path that silently resolves somewhere ephemeral. So this
 * file uses a real file on disk and reopens it from scratch.
 */

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rmm-durability-"))
const file = path.join(dir, "app.db")

type DbGlobal = { __rmmDb?: { sqlite: { pragma: (s: string) => unknown; close: () => void } } }

/** Drop the cached connection so the next import opens the file fresh. */
function forgetConnection(): void {
  const g = globalThis as DbGlobal
  try {
    g.__rmmDb?.sqlite.close()
  } catch {
    // Already closed; nothing to do.
  }
  delete g.__rmmDb
}

beforeAll(() => {
  process.env.DATABASE_PATH = file
})

afterAll(() => {
  forgetConnection()
  fs.rmSync(dir, { recursive: true, force: true })
})

function holder(n: number) {
  return {
    kind: "data_holder",
    org_name: `Durable Holder ${n}`,
    slug: `durable-holder-${n}`,
    org_type: "hospital",
    country: "DE",
    one_liner: "Survives a restart.",
    summary: "Written to a real file, then read back from a new connection.",
    languages: ["en"],
    looking_for: ["ai_partner"],
    application_status: "intend_to_apply",
    attending: [],
    contact_name: "Durable Person",
    contact_email: `durable-${n}@example.invalid`,
    datasets: [
      {
        name: "Cohort",
        modality: ["imaging_mri"],
        disease_area: ["oncology"],
        n_subjects: "10k_100k",
        volume: "1_10tb",
        longitudinal: true,
        annotation: "expert_labelled",
        linkage: ["outcomes"],
        standards: ["dicom"],
        readiness: "ai_ready",
        consent_basis: "broad_consent",
        access_model: "dua_required",
        data_can_leave_institution: "yes",
        ethics_approval: "approved",
        publicly_describable: true,
      },
    ],
  }
}

describe("on-disk durability", () => {
  it("writes commits that survive a brand-new connection", async () => {
    const first = await import("./profiles")
    const saved = first.saveProfile(holder(1), { isNew: true })
    expect(saved.id).toBeTruthy()

    // Close and reopen exactly as a container restart would.
    forgetConnection()

    const { getDb } = await import("./client")
    const reopened = getDb()
    const rows = reopened.all<{ slug: string }>("SELECT slug FROM profiles" as never)
    expect(rows.map((r) => r.slug)).toContain("durable-holder-1")
  })

  it("opens the file in WAL mode with a durable commit", async () => {
    await import("./client")
    const sqlite = (globalThis as DbGlobal).__rmmDb!.sqlite

    expect(sqlite.pragma("journal_mode")).toEqual([{ journal_mode: "wal" }])
    // 2 === FULL. NORMAL (1) does not fsync the WAL on commit, so a host
    // power-cut can drop the most recent profiles.
    expect(sqlite.pragma("synchronous")).toEqual([{ synchronous: 2 }])
  })

  it("resolves DATABASE_PATH rather than a path under the repo", async () => {
    await import("./client")
    expect(fs.existsSync(file)).toBe(true)
  })
})
