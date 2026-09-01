import { SiteChrome } from "@/components/site-chrome"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>
}
