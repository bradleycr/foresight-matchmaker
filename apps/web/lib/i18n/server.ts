import { cookies } from "next/headers"
import { isLocale, makeT, type Locale, type T, LOCALE_COOKIE } from "./index"

/** Resolve the active locale from the cookie; English by default. */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies()
  const value = jar.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : "en"
}

/** Locale + translator in one call — the standard page preamble. */
export async function getT(): Promise<{ locale: Locale; t: T }> {
  const locale = await getLocale()
  return { locale, t: makeT(locale) }
}
