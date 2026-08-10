/**
 * Full reset CLI. Run with: pnpm --filter @rmm/web db:reset
 *
 * Clears profiles, matches, intros, auth_tokens, and events, then reseeds
 * the synthetic directory and rebuilds the match cache from a pristine
 * state. Use this between rehearsals — see DEMO_RUNBOOK.md.
 */
import { resetAndReseed } from "./reset-core"

const count = resetAndReseed()
console.log(`Reset complete — cleared all tables, reseeded ${count} synthetic profiles, rebuilt the match cache.`)
