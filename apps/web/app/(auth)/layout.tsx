import { SiteChrome } from "@/components/site-chrome"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>
}
