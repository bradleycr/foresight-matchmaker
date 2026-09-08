"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { dictionaries, localeCookie, type Locale } from "./index"

/**
 * Client-side i18n. Dictionaries ship in the client bundle (the switcher
 * already imported them) so a language tap can repaint immediately — we do
 * not wait for the server round-trip that used to swallow the first tap.
 */

interface I18nContextValue {
  locale: Locale
  dict: Record<string, string>
  fallback: Record<string, string>
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  locale: serverLocale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  const [locale, setLocaleState] = useState(serverLocale)

  useEffect(() => {
    setLocaleState(serverLocale)
  }, [serverLocale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.documentElement.lang = next
    const secure = window.location.protocol === "https:" ? ";secure" : ""
    document.cookie = `${localeCookie(next)}${secure}`
  }, [])

  return (
    <I18nContext.Provider
      value={{ locale, dict: dictionaries[locale], fallback: dictionaries.en, setLocale }}
    >
      {children}
    </I18nContext.Provider>
  )
}

function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>")
  return ctx
}

export function useT() {
  const ctx = useI18n()

  return (key: string, vars?: Record<string, string | number>) => {
    const raw = ctx.dict[key] ?? ctx.fallback[key] ?? key
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
  }
}

export function useLocale(): Locale {
  return useI18n().locale
}

export function useSetLocale(): (locale: Locale) => void {
  return useI18n().setLocale
}
