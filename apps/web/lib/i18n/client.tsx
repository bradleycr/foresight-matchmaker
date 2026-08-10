"use client"

import { createContext, useContext } from "react"
import type { Locale } from "./index"

/**
 * Client-side i18n. The server layout injects the active locale's full
 * dictionary (a few KB) so client components translate with the same flat
 * keys as server code — no duplicated plumbing, no per-component props.
 */

interface I18nContextValue {
  locale: Locale
  dict: Record<string, string>
  fallback: Record<string, string>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  locale,
  dict,
  fallback,
  children,
}: I18nContextValue & { children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict, fallback }}>{children}</I18nContext.Provider>
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useT must be used inside <I18nProvider>")

  return (key: string, vars?: Record<string, string | number>) => {
    const raw = ctx.dict[key] ?? ctx.fallback[key] ?? key
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`))
  }
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useLocale must be used inside <I18nProvider>")
  return ctx.locale
}
