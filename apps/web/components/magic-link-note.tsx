import { getT } from "@/lib/i18n/server"

/** One line everywhere we ask for an email — no password, link sign-in, 30-day cookie. */
export async function MagicLinkNote({ className = "" }: { className?: string }) {
  const { t } = await getT()
  return (
    <p className={`border-l-4 border-teal bg-tint-teal px-4 py-3 text-sm leading-relaxed text-ink-soft ${className}`}>
      {t("auth.magic_link_note")}
    </p>
  )
}
