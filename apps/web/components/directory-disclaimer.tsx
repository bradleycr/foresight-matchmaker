import { getT } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

/**
 * SPRIND’s line, unmissable: this directory is for finding partners, not
 * for applying. The box hugs the copy so it reads as a notice, not a
 * vacant yellow panel. The “not an application” sentence stays its own
 * line, larger and bold.
 */
export async function DirectoryDisclaimer({ className }: { className?: string }) {
  const { t } = await getT()
  return (
    <aside
      role="note"
      className={cn(
        "w-fit max-w-3xl border border-ink border-l-4 bg-mark px-4 py-3 text-mark-ink sm:px-5 sm:py-3.5",
        className,
      )}
    >
      <p className="text-sm leading-snug sm:text-base">{t("directory.disclaimer_body")}</p>
      <p className="mt-2 text-sm leading-snug sm:text-base">{t("listing.glossary")}</p>
      <p className="mt-2 text-lg font-bold leading-tight sm:text-xl">
        {t("directory.disclaimer_not_application")}
      </p>
    </aside>
  )
}
