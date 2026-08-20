import { describe, expect, it } from "vitest"
import { activeChipTurn, answeredAsksFromMessages, gapsWithoutAnswered, overlayAskOnProfile, proposalFromAsk, resolveAsk } from "./ask"

describe("resolveAsk", () => {
  it("keeps a valid model ask", () => {
    expect(resolveAsk("methods")).toBe("methods")
    expect(resolveAsk("attending")).toBe("attending")
  })

  it("never invents chips when the model omitted ask", () => {
    expect(resolveAsk(undefined)).toBeNull()
  })

  it("never substitutes a different vocabulary for an invalid ask", () => {
    // Regression: "which events?" with ask="attending" used to fail isAskId,
    // then inference walked past attending and rendered language chips.
    expect(resolveAsk("whatever")).toBeNull()
    expect(resolveAsk("attending")).toBe("attending")
  })

  it("does not re-chip kind once the form already has one", () => {
    expect(resolveAsk("kind", { alreadyHasKind: true })).toBeNull()
  })

  it("does not re-chip a vocabulary the human already answered this session", () => {
    expect(resolveAsk("languages", { answered: ["languages"] })).toBeNull()
    expect(resolveAsk("attending", { answered: ["languages"] })).toBe("attending")
  })
})

describe("activeChipTurn", () => {
  it("never walks back to language chips after a later events question", () => {
    expect(
      activeChipTurn([
        { role: "assistant", content: "languages?", ask: "languages", askDone: false },
        { role: "user", content: "Working languages: English, German, French" },
        { role: "assistant", content: "Which events do you plan to attend?" },
      ]),
    ).toBeNull()
  })

  it("shows event chips on the latest turn", () => {
    expect(
      activeChipTurn([
        { role: "assistant", content: "languages?", ask: "languages", askDone: true },
        { role: "assistant", content: "Which events?", ask: "attending" },
      ]),
    ).toEqual({ index: 1, ask: "attending" })
  })

  it("hides chips once the human has already sent a reply", () => {
    expect(
      activeChipTurn([
        { role: "assistant", content: "Which events?", ask: "attending" },
        { role: "user", content: "Berlin" },
      ]),
    ).toBeNull()
  })
})

describe("answeredAsksFromMessages", () => {
  it("rebuilds answered vocabularies from askDone after a remount", () => {
    expect(
      answeredAsksFromMessages([
        { role: "assistant", content: "kind?", ask: "kind", askDone: true },
        { role: "assistant", content: "langs?", ask: "languages", askDone: true },
      ]),
    ).toEqual(["kind", "languages"])
  })
})

describe("gapsWithoutAnswered", () => {
  it("drops languages after they were chipped so the next turn can ask events", () => {
    expect(gapsWithoutAnswered(["languages", "attending", "contact_email"], ["languages"])).toEqual([
      "attending",
      "contact_email",
    ])
  })

  it("keeps the dataset gap until both modality and disease chips are done", () => {
    expect(gapsWithoutAnswered(["datasets"], ["modality"])).toEqual(["datasets"])
    expect(gapsWithoutAnswered(["datasets"], ["modality", "disease_area"])).toEqual([])
  })
})

describe("overlayAskOnProfile", () => {
  it("writes languages onto the snapshot Remmy reads next turn", () => {
    const next = overlayAskOnProfile({ languages: [] }, "languages", ["en", "de"])
    expect(next.languages).toEqual(["en", "de"])
  })
})

describe("proposalFromAsk", () => {
  it("maps disease chips to domain expertise for AI kinds", () => {
    const p = proposalFromAsk("domain_expertise", ["oncology", "neurology"], "ai_team")
    expect(p.domain_expertise).toEqual(["oncology", "neurology"])
    expect(p.data_needs).toBeUndefined()
  })

  it("maps modality chips onto a dataset for data holders", () => {
    const p = proposalFromAsk("modality", ["imaging_mri", "genomics"], "data_holder")
    expect(p.datasets?.[0]?.modality).toEqual(["imaging_mri", "genomics"])
  })

  it("maps optional modality chips onto data_needs for an individual", () => {
    const p = proposalFromAsk("modality", ["ehr_structured"], "individual")
    expect(p.data_needs?.modality).toEqual(["ehr_structured"])
    expect(p.datasets).toEqual([])
  })

  it("maps event chips onto attending", () => {
    const p = proposalFromAsk("attending", ["event_sept_1", "remote_only"], "ai_team")
    expect(p.attending).toEqual(["event_sept_1", "remote_only"])
  })
})
