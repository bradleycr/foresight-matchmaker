import { getT } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

/**
 * Profile ≠ application. The yellow mark is for programme surfaces where
 * people might confuse this directory with filing an official bid. The
 * homepage uses the quiet tone so the platform does not open as a
 * Recoding Medicine warning.
 *
 * When `applyHref` is set (application programmes only), the notice links
 * straight to the host's apply page — the line that used to sit alone at
 * the bottom of the programme page.
 */
export async function DirectoryDisclaimer({
  className,
  tone = "mark",
  applyHref,
  applyNote,
  applyLabel,
}: {
  className?: string
  tone?: "mark" | "quiet"
  applyHref?: string
  applyNote?: string
  applyLabel?: string
}) {
  const { t } = await getT()
  const showApply = Boolean(applyHref && applyLabel)

  if (tone === "quiet") {
    return (
      <aside role="note" className={cn("max-w-2xl", className)}>
        <p className="text-base leading-relaxed text-ink-soft">{t("directory.disclaimer_body")}</p>
        <p className="mt-2 text-base font-bold leading-snug">{t("directory.disclaimer_not_application")}</p>
      </aside>
    )
  }

  return (
    <aside
      role="note"
      className={cn(
        "w-fit max-w-3xl border border-ink border-l-4 bg-mark px-4 py-3 text-mark-ink sm:px-5 sm:py-3.5",
        className,
      )}
    >
      <p className="text-sm leading-snug sm:text-base">{t("directory.disclaimer_body")}</p>
      <p className="mt-2 text-lg font-bold leading-tight sm:text-xl">
        {t("directory.disclaimer_not_application")}
      </p>
      {showApply ? (
        <p className="mt-3 text-sm leading-snug sm:text-base">
          {applyNote ? <span>{applyNote} </span> : null}
          <a
            href={applyHref}
            className="font-bold underline underline-offset-2 hover:no-underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            {applyLabel}
          </a>
        </p>
      ) : null}
    </aside>
  )
}
