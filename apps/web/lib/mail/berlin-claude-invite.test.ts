import { describe, expect, it } from "vitest"
import {
  BERLIN_ATTENDING,
  BERLIN_CLAUDE_BLAST_ID,
  isSprindTeam,
} from "./berlin-claude-invite"

describe("berlin claude invite constants", () => {
  it("targets the Berlin Recoding Medicine attending chip", () => {
    expect(BERLIN_ATTENDING).toBe("event_sept_1")
    expect(BERLIN_CLAUDE_BLAST_ID).toBe("recoding_medicine_berlin_claude_v1")
  })

  it("excludes SPRIND team mailboxes and orgs", () => {
    expect(isSprindTeam("barbara.diehl@sprind.org")).toBe(true)
    expect(isSprindTeam("lorelei.logel-demoulin@sprind.org")).toBe(true)
    expect(isSprindTeam("someone@sprind.de")).toBe(true)
    expect(isSprindTeam("partner@example.org", "SPRIND Challenge Office")).toBe(true)
    expect(isSprindTeam("researcher@charite.de", "Charité")).toBe(false)
    expect(isSprindTeam("bradley@foresight.org")).toBe(false)
  })
})
