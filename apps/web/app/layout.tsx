import type { Metadata, Viewport } from "next"
import { Archivo, Archivo_Narrow } from "next/font/google"
import { I18nProvider } from "@/lib/i18n/client"
import { getT } from "@/lib/i18n/server"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import en from "@/locales/en.json"
import de from "@/locales/de.json"
import fr from "@/locales/fr.json"
import "./globals.css"

/**
 * Two typefaces, total. Archivo carries the UI; Archivo Narrow is the
 * condensed grotesque for the dense listing rows, with tabular numerals
 * enabled where figures must align.
 */
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" })
const archivoNarrow = Archivo_Narrow({ subsets: ["latin"], variable: "--font-archivo-narrow" })

const dictionaries = { en, de, fr } as const

const ORIGIN = process.env.APP_URL ?? "https://foresight-matchmaker.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: "Foresight Matchmaking",
  description:
    "A Foresight Institute directory for pairing organisations around open programmes. Recoding Medicine is the first: European health-data holders and AI teams forming joint SPRIND applications.",
  openGraph: {
    title: "Foresight Matchmaking",
    description:
      "A Foresight Institute directory for pairing organisations around open programmes. Recoding Medicine is the first: European health-data holders and AI teams forming joint SPRIND applications.",
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
      <body className={`${archivo.variable} ${archivoNarrow.variable} font-sans`}>
        <I18nProvider locale={locale} dict={dictionaries[locale]} fallback={dictionaries.en}>
          {/* Full-bleed foresight.org sky→teal→mint signal above the directory chrome. */}
          <div className="brand-band h-1.5 w-full" aria-hidden="true" />
          <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
            <SiteHeader />
            <main className="flex-1 pb-16">{children}</main>
            <SiteFooter />
          </div>
        </I18nProvider>
      </body>
    </html>
  )
}
