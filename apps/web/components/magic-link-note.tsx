import { getT } from "@/lib/i18n/server"
import type { DeliveryMode } from "@/lib/auth/mail"

/** How email sign-in works — only when we actually send a link. */
export async function MagicLinkNote({
  className = "",
  mode,
}: {
  className?: string
  mode?: DeliveryMode
}) {
  if (mode && mode !== "email") return null

  const { t } = await getT()
  return (
    <p className={`border-l-4 border-teal bg-tint-teal px-4 py-3 text-sm leading-relaxed text-ink-soft ${className}`}>
      {t("auth.magic_link_note")}
    </p>
  )
}
