import { describe, expect, it } from "vitest"
import { challengeById } from "@/lib/challenges/catalog"
import {
  PROFILE_NUDGE_CTA,
  RECODING_DEADLINE,
  renderHiddenListingEmail,
  renderProfileNudgeEmail,
  renderProgrammeNudgeEmail,
} from "./mail-templates"

describe("renderProfileNudgeEmail", () => {
  it("leads unpublished mail with the 16 October deadline in subject, preheader, and bold first line", () => {
    const mail = renderProfileNudgeEmail("unpublished")
    expect(RECODING_DEADLINE).toBe("16 October 2026, 18:00 CET")
    expect(mail.subject).toBe("Reminder: Recoding Medicine applications close 16 October")
    expect(mail.text.startsWith(`Reminder: Recoding Medicine applications close ${RECODING_DEADLINE}.`)).toBe(true)
    const deadlineAt = mail.html.indexOf("Reminder: Recoding Medicine applications close 16 October 2026")
    const titleAt = mail.html.indexOf("Finish your listing")
    const strongAt = mail.html.indexOf("font-weight:bold")
    expect(deadlineAt).toBeGreaterThan(0)
    expect(deadlineAt).toBeLessThan(titleAt)
    expect(strongAt).toBeGreaterThan(0)
    expect(strongAt).toBeLessThan(titleAt)
    expect(mail.html).toContain("You signed in")
    expect(mail.html).toContain(PROFILE_NUDGE_CTA.replace(/&/g, "&amp;"))
  })

  it("tells people who never opened the magic link to confirm, still leading with the deadline", () => {
    const mail = renderProfileNudgeEmail("unopened")
    expect(mail.subject).toBe("Reminder: Recoding Medicine applications close 16 October")
    expect(mail.text.startsWith(`Reminder: Recoding Medicine applications close ${RECODING_DEADLINE}.`)).toBe(true)
    expect(mail.html).toContain("Confirm your email")
    expect(mail.html).toContain("You asked for a Foresight Matchmaking sign-in link")
    expect(mail.html).toContain("Get a new sign-in link")
    expect(mail.html).not.toContain("You signed in to Foresight Matchmaking but you have not published")
    const deadlineAt = mail.html.indexOf("Reminder: Recoding Medicine applications close 16 October 2026")
    const titleAt = mail.html.indexOf("Confirm your email")
    expect(deadlineAt).toBeLessThan(titleAt)
  })
})

describe("renderProgrammeNudgeEmail", () => {
  it("does not invent a deadline for a rolling programme", () => {
    const asb = challengeById("ai_safety_berlin")
    const mail = renderProgrammeNudgeEmail(asb, "unpublished", "https://foresightmatchmaker.app/api/nudge/stop?t=demo")
    expect(mail.subject).toBe("Finish your AI Safety Berlin listing")
    expect(mail.html).toContain("AI Safety Berlin")
    expect(mail.html).toContain("Stop listing reminders")
    expect(mail.html).not.toContain("applications close")
    expect(mail.text).toContain("challenge%3Dai_safety_berlin")
  })

  it("still leads a deadline programme with the close date", () => {
    const rm = challengeById("recoding_medicine")
    const mail = renderProgrammeNudgeEmail(rm, "unpublished", "https://example.org/stop")
    expect(mail.subject).toBe("Reminder: Recoding Medicine applications close 16 October")
    expect(mail.html).toContain("font-weight:bold")
  })
})

describe("renderHiddenListingEmail", () => {
  it("leads with the deadline and points Hidden listings at Visibility on /me", () => {
    const mail = renderHiddenListingEmail()
    expect(mail.subject).toBe("Your Recoding Medicine listing is hidden")
    expect(mail.text.startsWith(`Reminder: Recoding Medicine applications close ${RECODING_DEADLINE}.`)).toBe(true)
    expect(mail.html).toContain("Your listing is hidden")
    expect(mail.html).toContain("visibility is set to Hidden")
    expect(mail.html).toContain("Change visibility")
    expect(mail.html).toContain("signin?next=%2Fme")
    const deadlineAt = mail.html.indexOf("Reminder: Recoding Medicine applications close 16 October 2026")
    const titleAt = mail.html.indexOf("Your listing is hidden")
    expect(deadlineAt).toBeGreaterThan(0)
    expect(deadlineAt).toBeLessThan(titleAt)
  })
})
