import { describe, expect, it } from "vitest"
import { parseRegisterDraft, registerDraftWorthSaving, type RegisterDraft } from "./register-draft"

function draft(partial: Partial<RegisterDraft> = {}): RegisterDraft {
  return {
    v: 1,
    savedAt: 1,
    path: "workspace",
    remmyStarted: true,
    remmyOpen: true,
    formVisible: true,
    form: {},
    remmyMessages: [],
    ...partial,
  }
}

describe("parseRegisterDraft", () => {
  it("accepts a v1 workspace snapshot", () => {
    const parsed = parseRegisterDraft({
      v: 1,
      savedAt: 99,
      path: "workspace",
      remmyStarted: true,
      remmyOpen: false,
      formVisible: true,
      form: { org_name: "Bradley Royes", kind: "individual" },
      remmyMessages: [{ role: "assistant", content: "Hello", ask: "kind" }],
    })
    expect(parsed?.form.org_name).toBe("Bradley Royes")
    expect(parsed?.remmyMessages).toHaveLength(1)
    expect(parsed?.remmyOpen).toBe(false)
  })

  it("rejects a different version", () => {
    expect(parseRegisterDraft({ v: 2, path: "workspace" })).toBeNull()
  })
})

describe("registerDraftWorthSaving", () => {
  it("keeps a chat that already has a user turn", () => {
    expect(
      registerDraftWorthSaving(
        draft({
          formVisible: false,
          remmyMessages: [
            { role: "assistant", content: "Hi" },
            { role: "user", content: "bradster germany" },
          ],
        }),
      ),
    ).toBe(true)
  })

  it("does not keep the empty chooser", () => {
    expect(registerDraftWorthSaving(draft({ path: "choose", remmyStarted: false, formVisible: false }))).toBe(false)
  })
})
