"use client"

import { useRouter } from "next/navigation"
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n"
import { useLocale } from "@/lib/i18n/client"

/** EN / DE / FR as plain text toggles. All three are fully translated. */
const LABELS: Record<Locale, string> = {
  en: "en",
  de: "de",
  fr: "fr",
}

export function LocaleSwitcher() {
  const router = useRouter()
  const active = useLocale()

  return (
    <div role="group" aria-label="Language" className="flex items-start gap-1 pt-1 text-sm">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={locale === active}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`
            router.refresh()
          }}
          className={
            locale === active
              ? "border border-ink bg-mark px-1.5 py-0.5 font-semibold uppercase text-mark-ink"
              : "border border-transparent px-1.5 py-0.5 uppercase text-ink-soft hover:text-ink"
          }
        >
          {LABELS[locale]}
        </button>
      ))}
    </div>
  )
}
