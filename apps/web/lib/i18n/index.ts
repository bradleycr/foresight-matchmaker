import en from "@/locales/en.json"
import de from "@/locales/de.json"
import fr from "@/locales/fr.json"

/**
 * Deliberately small i18n runtime: flat-key dictionaries, {var} interpolation,
 * English fallback. Every user-facing string lives in /locales/*.json —
 * English, German, and French are all fully translated.
 */

export const LOCALES = ["en", "de", "fr"] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_COOKIE = "rmm_locale"

const dictionaries: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  de: de as Record<string, string>,
  fr: fr as Record<string, string>,
}

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value)
}

/** Look up `key` in `locale`, falling back to English, then the key itself. */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = dictionaries[locale][key] ?? dictionaries.en[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
}

/** Curried translator — the shape every page passes down to components. */
export function makeT(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars)
}

export type T = ReturnType<typeof makeT>
