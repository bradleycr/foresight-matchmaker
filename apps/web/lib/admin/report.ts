import { hydrateEvents, hydrateListings } from "@/lib/db/durable"
import { collectSignupRows, summarizeSignups, type SignupRow } from "@/lib/db/signups"
import { computeMetrics, type Metrics } from "@/lib/metrics"

/** Everything the operator desk shows for one programme, from a single pull. */
export interface ProgrammeReport {
  signups: SignupRow[]
  metrics: Metrics
}

/**
 * Signups and metrics for one programme — or the whole app when
 * `challengeId` is omitted.
 *
 * The two halves share one durable pull and one signup pass. The report page
 * used to reach /api/v1/metrics over HTTP, which re-hydrated the corpus in a
 * second isolate and put the render behind the fetch client's 8s timeout —
 * long enough on a cold start to trip the error boundary and read as an
 * outage.
 */
export async function buildProgrammeReport(challengeId?: string): Promise<ProgrammeReport> {
  await Promise.all([hydrateListings(), hydrateEvents()])

  const signups = await collectSignupRows(challengeId ? { challengeId } : undefined)
  const metrics = computeMetrics({ challengeId, signups: summarizeSignups(signups) })

  return { signups, metrics }
}
