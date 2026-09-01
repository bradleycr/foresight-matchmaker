import { describe, expect, it } from "vitest"
import { civilDateInBerlin, isOnsiteCitySlug, liveFeedCity, onsiteCity } from "./cities"

describe("onsite cities", () => {
  it("accepts the three room slugs", () => {
    expect(isOnsiteCitySlug("berlin")).toBe(true)
    expect(isOnsiteCitySlug("paris")).toBe(true)
    expect(isOnsiteCitySlug("stockholm")).toBe(true)
    expect(isOnsiteCitySlug("london")).toBe(false)
    expect(onsiteCity("berlin")?.attending).toBe("event_sept_1")
  })

  it("formats a civil date in Europe/Berlin", () => {
    expect(civilDateInBerlin(new Date("2026-09-01T22:30:00.000Z"))).toBe("2026-09-02")
  })

  it("opens Berlin until Paris's date, then Paris, then Stockholm", () => {
    expect(liveFeedCity(new Date("2026-09-01T12:00:00+02:00"))).toBe("berlin")
    expect(liveFeedCity(new Date("2026-09-02T20:00:00+02:00"))).toBe("berlin")
    expect(liveFeedCity(new Date("2026-09-09T10:00:00+02:00"))).toBe("paris")
    expect(liveFeedCity(new Date("2026-09-17T10:00:00+02:00"))).toBe("stockholm")
    expect(liveFeedCity(new Date("2026-10-01T10:00:00+02:00"))).toBe("stockholm")
  })
})
