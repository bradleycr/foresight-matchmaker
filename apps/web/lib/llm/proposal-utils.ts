import type { PrefillProposal } from "./prefill"

/** True when a proposal has enough to visibly fill the form. */
export function proposalIsSubstantial(p: PrefillProposal | null | undefined): boolean {
  if (!p) return false
  return Boolean(p.org_name?.trim() || p.one_liner?.trim() || p.summary?.trim())
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
  out.push("Contact email must still be entered on the form.")
  return out
}

/** Flatten chat turns into prose for the schema-first extractor. */
export function transcriptFromMessages(
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>,
): string {
  return messages
    .map((m) => `${m.role === "user" ? "User" : "Remmy"}: ${m.content}`)
    .join("\n\n")
    .trim()
}
