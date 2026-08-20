/**
 * Operator inbox for privacy requests and beta bug reports.
 * One address, shown in the footer, /privacy, and the error-boundary mailto.
 */
export const DEFAULT_CONTACT_EMAIL = "bradley@foresight.org"

export function contactEmail(): string {
  return process.env.PRIVACY_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL
}

/** Soft cap so `mailto:` survives Outlook / iOS Mail URL limits. */
const MAILTO_BODY_LIMIT = 1400

export function truncateForMailto(text: string, limit = MAILTO_BODY_LIMIT): string {
  const trimmed = text.trim()
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit - 1)}…`
}

export function formatErrorDetails(input: {
  message?: string
  digest?: string
  url?: string
  when?: string
}): string {
  const lines = [
    input.url ? `Page: ${input.url}` : null,
    input.when ? `Time: ${input.when}` : null,
    input.digest ? `Reference: ${input.digest}` : null,
    input.message ? `Message: ${truncateForMailto(input.message, 800)}` : null,
  ].filter((line): line is string => Boolean(line))
  return lines.join("\n")
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(truncateForMailto(body))}`
}
