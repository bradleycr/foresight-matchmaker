import type { PrefillProposal } from "./prefill"
import { proposalWarnings } from "./sanitize-proposal"

/** True when a proposal has enough to visibly fill the form. */
export function proposalIsSubstantial(p: PrefillProposal | null | undefined): boolean {
  if (!p) return false
  const hasIdentity = Boolean(p.org_name?.trim() || p.one_liner?.trim())
  const hasContext = Boolean(p.summary?.trim() || p.kind || p.country)
  return hasIdentity && hasContext
}

/** Bullets for the human review card before applying a draft to the form. */
export function summaryFromProposal(p: PrefillProposal | null): string[] {
  if (!p) return []
  const out: string[] = []
  if (p.kind) out.push(`Kind: ${p.kind}`)
  if (p.org_name) out.push(`Organisation: ${p.org_name}`)
  if (p.country) out.push(`Country: ${p.country}`)
  if (p.one_liner) out.push(p.one_liner)
  if (p.looking_for?.length) out.push(`Looking for: ${p.looking_for.join(", ")}`)
  if (p.methods?.length) out.push(`Methods: ${p.methods.join(", ")}`)
  if (p.datasets?.length) out.push(`Datasets drafted: ${p.datasets.length}`)
  out.push(...proposalWarnings(p))
  return out
}

/**
 * Flatten chat turns for the schema extractor.
 * Skips Remmy's opening boilerplate and short acknowledgements that dilute extraction.
 */
export function transcriptForExtraction(
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>,
): string {
  const lines: string[] = []

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!
    if (i === 0 && m.role === "assistant") continue
    if (m.role === "assistant" && m.content.length < 80 && !m.content.includes("?")) continue
    lines.push(`${m.role === "user" ? "User" : "Remmy"}: ${m.content}`)
  }

  return lines.join("\n\n").trim()
}

/** @deprecated Use transcriptForExtraction */
export function transcriptFromMessages(
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>,
): string {
  return transcriptForExtraction(messages)
}
