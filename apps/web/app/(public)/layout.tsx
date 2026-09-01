import { SiteChrome } from "@/components/site-chrome"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>
}
