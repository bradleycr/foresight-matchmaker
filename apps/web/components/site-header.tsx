import { peekLiveSession } from "@/lib/auth/live-session"
import { getSession } from "@/lib/auth/session"
import { signInHref } from "@/lib/auth/next-path"
import { browseDirectoryPath } from "@/lib/challenges/visibility"
import { SiteMasthead } from "./site-masthead"

/**
 * Masthead: session is resolved on the server; labels live in the client
 * dictionary so language changes do not wait on this request.
 */
export async function SiteHeader() {
  const live = await peekLiveSession()
  const session = live ? live.session : await getSession()
  const directoryHref = session ? browseDirectoryPath(live?.profile.challenge_id) : signInHref("/directory")

  return (
    <SiteMasthead
      directoryHref={directoryHref}
      signedIn={Boolean(session)}
      listed={Boolean(live)}
    />
  )
}
