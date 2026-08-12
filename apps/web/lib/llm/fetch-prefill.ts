import type { PrefillProposal } from "@/lib/llm/prefill"
import { proposalIsSubstantial } from "@/lib/llm/proposal-utils"
import { sanitizeProposal } from "@/lib/llm/sanitize-proposal"

export type PrefillFailure =
  | "network"
  | "rate_limited"
  | "disabled"
  | "too_short"
  | "extraction_failed"
  | "insubstantial"

export type PrefillResult =
  | { ok: true; proposal: PrefillProposal }
  | { ok: false; reason: PrefillFailure; message: string }

/**
 * Client wrapper for POST /api/v1/prefill — shared by Remmy chat and PrefillBox.
 */
export async function fetchPrefill(text: string, source: "chat" | "paste" = "chat"): Promise<PrefillResult> {
  const trimmed = text.trim()
  if (trimmed.length < 40) {
    return { ok: false, reason: "too_short", message: "Paste at least a sentence or two." }
  }

  let res: Response
  try {
    res = await fetch("/api/v1/prefill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, source }),
    })
  } catch {
    return { ok: false, reason: "network", message: "Could not reach the pre-fill service." }
  }

  const body = (await res.json().catch(() => null)) as {
    proposal?: PrefillProposal
    error?: string
    code?: string
  } | null

  if (res.status === 503) {
    return { ok: false, reason: "disabled", message: body?.error ?? "Pre-fill is not available." }
  }

  if (res.status === 429) {
    return { ok: false, reason: "rate_limited", message: body?.error ?? "Too many requests — wait a minute." }
  }

  if (!res.ok) {
    const reason: PrefillFailure =
      body?.code === "insubstantial" ? "insubstantial" : "extraction_failed"
    return {
      ok: false,
      reason,
      message: body?.error ?? "Could not derive a draft from that text.",
    }
  }

  const proposal = sanitizeProposal(body?.proposal ?? ({} as PrefillProposal))
  if (!proposalIsSubstantial(proposal)) {
    return {
      ok: false,
      reason: "insubstantial",
      message: "Not enough to fill the form — include your organisation name and what you do.",
    }
  }

  return { ok: true, proposal }
}
