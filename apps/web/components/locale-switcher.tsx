"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LOCALES, type Locale } from "@/lib/i18n"
import { useLocale, useSetLocale } from "@/lib/i18n/client"

/** EN / DE / FR as plain text toggles. All three are fully translated. */
const LABELS: Record<Locale, string> = {
  en: "en",
  de: "de",
  fr: "fr",
}

export function LocaleSwitcher() {
  const router = useRouter()
  const active = useLocale()
  const setLocale = useSetLocale()
  const [pending, startTransition] = useTransition()

  function choose(locale: Locale) {
    if (locale === active) return
    setLocale(locale)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div
      role="group"
      aria-label="Language"
      aria-busy={pending || undefined}
      className="flex items-start gap-1 pt-1 text-sm"
    >
      {LOCALES.map((locale) => {
        const pressed = locale === active
        return (
          <button
            key={locale}
            type="button"
            aria-pressed={pressed}
            aria-busy={pending && pressed ? true : undefined}
            onClick={() => choose(locale)}
            className={
              pressed
                ? "min-h-11 min-w-11 border border-ink bg-mark px-1.5 py-0.5 font-semibold uppercase text-mark-ink touch-manipulation sm:min-h-0 sm:min-w-0"
                : "min-h-11 min-w-11 border border-transparent px-1.5 py-0.5 uppercase text-ink-soft touch-manipulation hover:text-ink sm:min-h-0 sm:min-w-0"
            }
          >
            {LABELS[locale]}
          </button>
        )
      })}
    </div>
  )
}
