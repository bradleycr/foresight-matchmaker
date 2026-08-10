/**
 * Scripted demo state. Run with: pnpm --filter @rmm/web db:demo
 *
 * Resets and reseeds (see reset-core.ts), then pre-loads one pending
 * received introduction and one already-accepted introduction into a known
 * demo profile's inbox — so the double opt-in flow, including the revealed
 * contact block, can be shown on stage without live-typing both sides of an
 * exchange. The sign-in email is printed at the end; it is also documented
 * in DEMO_RUNBOOK.md.
 *
 * All three profiles below are golden fixtures (seed/golden/), so their
 * slugs are stable across reseeds.
 */
import { resetAndReseed } from "./reset-core"
import { getProfileBySlug } from "./profiles"
import { requestIntro, respondToIntro } from "./intros"

const DEMO_SLUG = "rpaz-zuid" // Stichting Regionaal Pathologie Archief Zuid
const PENDING_FROM_SLUG = "elbe-vision-lab" // Elbe Vision Lab, TU Nordharz — sends the pending request
const ACCEPTED_FROM_SLUG = "federation-neuro-ia-lyon" // Fédération Neuro-IA, Lyon — already accepted

const count = resetAndReseed()

const demo = getProfileBySlug(DEMO_SLUG)
const pendingFrom = getProfileBySlug(PENDING_FROM_SLUG)
const acceptedFrom = getProfileBySlug(ACCEPTED_FROM_SLUG)

if (!demo || !pendingFrom || !acceptedFrom) {
  throw new Error(
    `db:demo expects the golden profiles "${DEMO_SLUG}", "${PENDING_FROM_SLUG}", and "${ACCEPTED_FROM_SLUG}" ` +
      "to exist after seeding — check seed/golden/ for renamed or removed slugs.",
  )
}

const pending = requestIntro(
  pendingFrom.id,
  demo.id,
  "We reviewed your pathology archive and think there's a strong fit for the Recoding Medicine application — would you be open to a short call this week?",
)
if (!pending.ok) throw new Error(`Could not seed the pending demo intro: ${pending.error}`)

const accepted = requestIntro(
  acceptedFrom.id,
  demo.id,
  "Following up after the webinar — our federated pipeline should work well against your on-premises constraint. Keen to discuss a joint application.",
)
if (!accepted.ok) throw new Error(`Could not seed the accepted demo intro: ${accepted.error}`)
respondToIntro(accepted.intro.id, "accepted")

console.log(
  `Demo state ready — reset, reseeded ${count} profiles, and loaded 1 pending + 1 accepted intro into ${DEMO_SLUG}'s inbox.`,
)
console.log(`Sign in as: ${demo.contact_email}`)
