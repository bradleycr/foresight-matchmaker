import { getT } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

/**
 * Explains the one-listing-per-email rule and how to switch profile type.
 */
export async function OneListingNote({ className }: { className?: string }) {
  const { t } = await getT()
  return (
    <aside
      role="note"
      className={cn(
        "max-w-xl border border-rule-strong border-l-4 border-l-teal bg-paper-shade px-4 py-3 text-sm leading-relaxed text-ink-soft sm:px-5",
        className,
      )}
    >
      <p>{t("register.one_listing")}</p>
      <p className="mt-2">{t("register.one_listing_switch")}</p>
    </aside>
  )
}
