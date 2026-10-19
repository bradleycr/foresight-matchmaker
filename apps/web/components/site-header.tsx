import { peekLiveSession } from "@/lib/auth/live-session"
import { getSession } from "@/lib/auth/session"
import { signInHref } from "@/lib/auth/next-path"
import { requestDeskPreference } from "@/lib/challenges/active-programme"
import { browseDirectoryPath, requestDemoUnlock } from "@/lib/challenges/visibility"
import { SiteMasthead } from "./site-masthead"

/**
 * Masthead: session is resolved on the server; labels live in the client
 * dictionary so language changes do not wait on this request.
 *
 * Signed-in people pick a programme desk; Directory follows that choice.
 */
export async function SiteHeader() {
  const live = await peekLiveSession()
  const session = live ? live.session : await getSession()
  const unlock = session ? await requestDemoUnlock() : null
  const desk = session ? await requestDeskPreference() : null
  const directoryHref = session
    ? browseDirectoryPath(live?.profile.challenge_id, unlock, desk)
    : signInHref("/directory")

  return (
    <SiteMasthead
      directoryHref={directoryHref}
      programmesHref={session ? "/programmes" : "/#programmes"}
      signedIn={Boolean(session)}
      listed={Boolean(live)}
      listingName={live?.profile.org_name}
    />
  )
}
