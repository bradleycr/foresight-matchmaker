/**
 * In-progress /register listing. Lives in this browser until they submit.
 * Email is already confirmed; a refresh must not wipe Remmy + the form.
 */

export const REGISTER_DRAFT_KEY = "rmm.register-draft.v1"

export type RemmyDraftMessage = {
  role: "user" | "assistant"
  content: string
  ask?: string
  askDone?: boolean
}

export type RegisterDraft = {
  v: 1
  savedAt: number
  path: "choose" | "workspace"
  remmyStarted: boolean
  remmyOpen: boolean
  formVisible: boolean
  form: Record<string, unknown>
  remmyMessages: RemmyDraftMessage[]
}

function asMessages(value: unknown): RemmyDraftMessage[] {
  if (!Array.isArray(value)) return []
  const out: RemmyDraftMessage[] = []
  for (const row of value) {
    if (!row || typeof row !== "object") continue
    const rec = row as Record<string, unknown>
    if (rec.role !== "user" && rec.role !== "assistant") continue
    if (typeof rec.content !== "string" || rec.content.length === 0) continue
    out.push({
      role: rec.role,
      content: rec.content.slice(0, 4000),
      ...(typeof rec.ask === "string" ? { ask: rec.ask } : {}),
      ...(rec.askDone === true ? { askDone: true } : {}),
    })
    if (out.length >= 48) break
  }
  return out
}

export function parseRegisterDraft(raw: unknown): RegisterDraft | null {
  if (!raw || typeof raw !== "object") return null
  const rec = raw as Record<string, unknown>
  if (rec.v !== 1) return null
  if (rec.path !== "choose" && rec.path !== "workspace") return null
  if (typeof rec.savedAt !== "number" || !Number.isFinite(rec.savedAt)) return null
  if (typeof rec.form !== "object" || rec.form === null || Array.isArray(rec.form)) return null
  return {
    v: 1,
    savedAt: rec.savedAt,
    path: rec.path,
    remmyStarted: rec.remmyStarted === true,
    remmyOpen: rec.remmyOpen !== false,
    formVisible: rec.formVisible === true,
    form: rec.form as Record<string, unknown>,
    remmyMessages: asMessages(rec.remmyMessages),
  }
}

export function registerDraftWorthSaving(draft: RegisterDraft): boolean {
  if (draft.path !== "workspace") return false
  if (draft.remmyMessages.some((m) => m.role === "user")) return true
  if (draft.formVisible) {
    const name = draft.form.org_name
    if (typeof name === "string" && name.trim().length > 0) return true
    const line = draft.form.one_liner
    if (typeof line === "string" && line.trim().length > 0) return true
    const email = draft.form.contact_email
    if (typeof email === "string" && email.trim().length > 0) return true
  }
  return draft.remmyStarted
}

export function loadRegisterDraft(): RegisterDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(REGISTER_DRAFT_KEY)
    if (!raw) return null
    return parseRegisterDraft(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveRegisterDraft(draft: RegisterDraft): void {
  if (typeof window === "undefined") return
  try {
    if (!registerDraftWorthSaving(draft)) {
      window.localStorage.removeItem(REGISTER_DRAFT_KEY)
      return
    }
    window.localStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Quota or private mode — the form still works; they just cannot resume.
  }
}

export function clearRegisterDraft(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(REGISTER_DRAFT_KEY)
  } catch {
    // ignore
  }
}
