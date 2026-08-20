import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { I18nProvider } from "@/lib/i18n/client"
import { getT } from "@/lib/i18n/server"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import en from "@/locales/en.json"
import de from "@/locales/de.json"
import fr from "@/locales/fr.json"
import { publicOrigin } from "@/lib/public-origin"
import { contactEmail } from "@/lib/contact"
import "./globals.css"

/**
 * Exact foresight.org faces — Neue Haas Unica Pro (UI) and ABC Arizona Text
 * (display). Medium (500) is remapped to 600/700 so existing font-semibold /
 * font-bold utility classes resolve without faux-bolding.
 */
const unica = localFont({
  src: [
    { path: "../fonts/unica-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/unica-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/unica-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/unica-500-italic.woff2", weight: "500", style: "italic" },
    { path: "../fonts/unica-500.woff2", weight: "600", style: "normal" },
    { path: "../fonts/unica-500-italic.woff2", weight: "600", style: "italic" },
    { path: "../fonts/unica-500.woff2", weight: "700", style: "normal" },
    { path: "../fonts/unica-500-italic.woff2", weight: "700", style: "italic" },
  ],
  variable: "--font-unica",
  display: "swap",
})

const arizona = localFont({
  src: [
    { path: "../fonts/arizona-text-300.woff2", weight: "300", style: "normal" },
    { path: "../fonts/arizona-text-300-italic.woff2", weight: "300", style: "italic" },
    // Display-only cut on foresight.org — map heavier requests to the light file.
    { path: "../fonts/arizona-text-300.woff2", weight: "400", style: "normal" },
    { path: "../fonts/arizona-text-300.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-arizona",
  display: "swap",
})

const dictionaries = { en, de, fr } as const

const ORIGIN = publicOrigin()

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: "Foresight Matchmaking",
  description:
    "A Foresight Institute directory for pairing organisations around open programmes. Recoding Medicine is the first: European health-data holders and AI teams forming joint applications.",
  openGraph: {
    title: "Foresight Matchmaking",
    description:
      "A Foresight Institute directory for pairing organisations around open programmes. Recoding Medicine is the first: European health-data holders and AI teams forming joint applications.",
    type: "website",
    locale: "en_GB",
    siteName: "Foresight Matchmaking",
  },
  twitter: {
    card: "summary_large_image",
    title: "Foresight Matchmaking",
    description:
      "A Foresight Institute directory for pairing organisations around open programmes.",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#e5f0f6",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale } = await getT()

  return (
    <html lang={locale}>
      <body className={`${unica.variable} ${arizona.variable} font-sans`} data-contact-email={contactEmail()}>
        <I18nProvider locale={locale} dict={dictionaries[locale]} fallback={dictionaries.en}>
          {/* Full-bleed foresight.org sky→teal→mint signal above the directory chrome. */}
          <div className="brand-band h-1.5 w-full" aria-hidden="true" />
          <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
            <SiteHeader />
            <main className="flex flex-1 flex-col pb-16">{children}</main>
            <SiteFooter />
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}
