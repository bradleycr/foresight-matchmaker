/**
 * Scripted demo state. Run with: pnpm --filter @rmm/web db:demo
 *
 * Resets and reseeds, then records two emailed introductions into a known
 * demo profile's contacts log — so the off-platform email record can be
 * shown on stage. The sign-in email is printed at the end.
 *
 * All three profiles below are golden fixtures (seed/golden/), so their
 * slugs are stable across reseeds.
 */
import { resetAndReseed } from "./reset-core"
import { getProfileBySlug } from "./profiles"
import { requestIntro } from "./intros"

const DEMO_SLUG = "rpaz-zuid"
const FROM_A = "elbe-vision-lab"
const FROM_B = "federation-neuro-ia-lyon"

const count = resetAndReseed()

const demo = getProfileBySlug(DEMO_SLUG)
const fromA = getProfileBySlug(FROM_A)
const fromB = getProfileBySlug(FROM_B)

if (!demo || !fromA || !fromB) {
  throw new Error(
    `db:demo expects the golden profiles "${DEMO_SLUG}", "${FROM_A}", and "${FROM_B}" ` +
      "to exist after seeding — check seed/golden/ for renamed or removed slugs.",
  )
}

const a = requestIntro(
  fromA.id,
  demo.id,
  "We reviewed your pathology archive and think there's a strong fit — would you be open to a short call this week?",
)
if (!a.ok) throw new Error(`Could not seed demo intro A: ${a.error}`)

const b = requestIntro(
  fromB.id,
  demo.id,
  "Following up after the webinar — our federated pipeline should work well against your on-premises constraint.",
)
if (!b.ok) throw new Error(`Could not seed demo intro B: ${b.error}`)

console.log(`Demo state ready — reset, reseeded ${count} profiles, and loaded 2 emailed intros into ${DEMO_SLUG}'s contacts.`)
console.log(`Sign in as: ${demo.contact_email}`)
