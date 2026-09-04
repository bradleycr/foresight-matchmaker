import { SiteFooter } from "./site-footer"
import { SiteHeader } from "./site-header"
import { SessionRenew } from "./session-renew"
import { NavProgress } from "./nav-progress"

/** Directory frame: brand band, masthead, page, colophon. */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavProgress />
      <SessionRenew />
      <div className="brand-band h-1.5 w-full" aria-hidden="true" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6">
        <SiteHeader />
        <main className="flex flex-1 flex-col pb-16">{children}</main>
        <SiteFooter />
      </div>
    </>
  )
}
