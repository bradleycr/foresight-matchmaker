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

const ORIGIN = process.env.APP_URL ?? "https://matchmaker-sprind.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: "Recoding Medicine Matchmaker",
  description:
    "A directory pairing European health-data holders with AI teams for the SPRIND Recoding Medicine challenge. Application deadline: 16 October 2026.",
  openGraph: {
    title: "Recoding Medicine Matchmaker",
    description:
      "A directory pairing European health-data holders with AI teams for the SPRIND Recoding Medicine challenge. Application deadline: 16 October 2026.",
    type: "website",
    locale: "en_GB",
    siteName: "Recoding Medicine Matchmaker",
  },
  twitter: {
    card: "summary_large_image",
    title: "Recoding Medicine Matchmaker",
    description:
      "A directory pairing European health-data holders with AI teams for the SPRIND Recoding Medicine challenge.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#faf8f2",
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale } = await getT()

  return (
    <html lang={locale}>
      <body className={`${archivo.variable} ${archivoNarrow.variable} font-sans`}>
        <I18nProvider locale={locale} dict={dictionaries[locale]} fallback={dictionaries.en}>
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
