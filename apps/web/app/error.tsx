"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"

/**
 * Root error boundary. Wraps every route segment's page/layout below the
 * root layout (see Next.js file-convention docs), so header/footer/locale
 * context all still render — only the failing segment is replaced.
 *
 * Deliberately plain: a visible, honest failure state in the same square-
 * corners/1px-ink-border aesthetic as the rest of the app, not a stack
 * trace and not a silent redirect to /signin (see server-fetch.ts —
 * that bug is exactly what this file exists to make impossible to miss).
 */
export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const t = useT()

  useEffect(() => {
    console.error("[error boundary]", error)
  }, [error])

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="font-listing text-3xl font-bold uppercase tracking-tight">{t("error.title")}</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{t("error.body")}</p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-faint">
          {t("error.digest_label")}: <span className="tnum">{error.digest}</span>
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-11 border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
        >
          {t("error.retry")}
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          {t("error.back")}
        </Link>
      </div>
    </div>
  )
}
