import { describe, it, expect, beforeAll } from "vitest"

process.env.DATABASE_PATH = ":memory:"

import { logEvent } from "./db/events"
import { computeMetrics } from "./metrics"

describe("computeMetrics intro funnel", () => {
  beforeAll(() => {
    logEvent("intro_requested", "alice", { to: "bob", channel: "email" })
    logEvent("intro_requested", "alice", { to: "bob", channel: "email" })
    logEvent("intro_requested", "alice", { to: "bob", channel: "linkedin" })
    logEvent("intro_requested", "alice", { to: "cara", channel: "email" })
    logEvent("shortlist_viewed", "alice", { count: 3 })
    logEvent("shortlist_viewed", "alice", { count: 3 })
  })

  it("counts unique contact pairs, not raw clicks", () => {
    const m = computeMetrics()
    expect(m.funnel.intros_requested).toBe(2)
    expect(m.funnel.contact_email).toBe(2)
    expect(m.funnel.contact_linkedin).toBe(1)
  })

  it("counts unique shortlist viewers", () => {
    const m = computeMetrics()
    expect(m.funnel.profiles_with_shortlist_view).toBe(1)
  })

  it("folds a signup summary into the top of the funnel", () => {
    const m = computeMetrics({
      signups: {
        total: 10,
        requested: 3,
        confirmed: 2,
        listed: 5,
        signed_in: 7,
        unfinished: 5,
        unfinishedConfirmedEmails: ["a@x.org", "b@x.org"],
        unfinishedEmails: ["a@x.org", "b@x.org", "c@x.org"],
      },
    })
    expect(m.funnel.signups).toBe(10)
    expect(m.funnel.signed_in).toBe(7)
    expect(m.funnel.unfinished).toBe(5)
    expect(m.funnel.unfinished_confirmed).toBe(2)
  })
})
