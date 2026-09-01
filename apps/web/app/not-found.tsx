import { SiteChrome } from "@/components/site-chrome"
import { NotFoundCopy } from "@/components/not-found-copy"

/**
 * Unmatched URLs (no route group). Directory 404s live in (public)/not-found
 * so they do not double-wrap the chrome.
 */
export default async function NotFound() {
  return (
    <SiteChrome>
      <NotFoundCopy />
    </SiteChrome>
  )
}
