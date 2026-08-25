"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import { formatErrorDetails, mailtoHref } from "@/lib/contact"

type ErrorBits = {
  message?: string
  digest?: string
}

function operatorInbox(fallback: string): string {
  return document.body.getAttribute("data-contact-email")?.trim() || fallback
}

function composeMailto(
  email: string,
  subject: string,
  bodyTemplate: string,
  error?: ErrorBits,
  live?: boolean,
): string {
  const details = formatErrorDetails({
    message: error?.message,
    digest: error?.digest,
    url: live ? window.location.href : undefined,
    when: live ? new Date().toISOString() : undefined,
  })
  const body = bodyTemplate.replace("{details}", () => details)
  return mailtoHref(live ? operatorInbox(email) : email, subject, body)
}

/**
 * Opens the operator inbox with a filled subject and body. First paint uses
 * a static mailto (works with JS off); after mount we stamp the current page
 * and time so a report from /me is distinguishable from one from /directory.
 */
export function BugReportMailto({
  email,
  error,
  className,
  children,
}: {
  email: string
  error?: ErrorBits
  className?: string
  children: ReactNode
}) {
  const t = useT()
  const subject = error ? t("error.mail_subject") : t("footer.mail_subject")
  const template = error ? t("error.mail_body") : t("footer.mail_body")
  const fallback = composeMailto(email, subject, template, error)
  const [href, setHref] = useState(fallback)

  useEffect(() => {
    setHref(composeMailto(email, subject, template, error, true))
  }, [email, subject, template, error])

  return (
    <a href={href} className={className}>
      {children}
    </a>
  )
}

export function CopyErrorDetails({ error }: { error: ErrorBits }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  return (
    <Button
      type="button"
      className="min-h-11"
      onClick={async () => {
        const details = formatErrorDetails({
          message: error.message,
          digest: error.digest,
          url: window.location.href,
          when: new Date().toISOString(),
        })
        try {
          await navigator.clipboard.writeText(details)
          setCopied(true)
        } catch {
          /* mailto remains the fallback */
        }
      }}
    >
      {copied ? t("error.copied") : t("error.copy_details")}
    </Button>
  )
}

/**
 * Error-boundary companion: the message itself (so it can be selected),
 * then copy + mailto so a beta tester can send it in one gesture.
 */
export function ErrorReportPanel({
  email,
  error,
}: {
  email: string
  error: ErrorBits
}) {
  const t = useT()
  const shown = [error.digest && `${t("error.digest_label")}: ${error.digest}`, error.message]
    .filter(Boolean)
    .join("\n")

  return (
    <section className="mt-8 border border-rule bg-paper-shade p-4" aria-labelledby="error-report-heading">
      <h2 id="error-report-heading" className="font-listing text-lg font-bold uppercase">
        {t("error.report_title")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("error.report_body")}</p>
      {shown ? (
        <pre
          tabIndex={0}
          className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words border border-rule bg-paper p-3 font-mono text-xs text-ink-soft"
        >
          {shown}
        </pre>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <CopyErrorDetails error={error} />
        <BugReportMailto
          email={email}
          error={error}
          className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("error.email_report")}
        </BugReportMailto>
      </div>
    </section>
  )
}

/**
 * Compact copy + mailto under an in-form alert. Same actions as the error
 * boundary, without a second heading or a large panel.
 */
export function FailureReportActions({
  email,
  message,
}: {
  email: string
  message: string
}) {
  const t = useT()
  const error = useMemo(() => ({ message }), [message])
  return (
    <div className="mt-3">
      <p className="text-sm leading-relaxed text-ink-soft">{t("error.inline_hint")}</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <CopyErrorDetails error={error} />
        <BugReportMailto
          email={email}
          error={error}
          className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("error.email_report")}
        </BugReportMailto>
      </div>
    </div>
  )
}
