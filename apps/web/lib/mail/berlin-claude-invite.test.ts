import { describe, expect, it } from "vitest"
import { BERLIN_ATTENDING, BERLIN_CLAUDE_BLAST_ID } from "./berlin-claude-invite"

describe("berlin claude invite constants", () => {
  it("targets the Berlin Recoding Medicine attending chip", () => {
    expect(BERLIN_ATTENDING).toBe("event_sept_1")
    expect(BERLIN_CLAUDE_BLAST_ID).toBe("recoding_medicine_berlin_claude_v1")
  })
})
