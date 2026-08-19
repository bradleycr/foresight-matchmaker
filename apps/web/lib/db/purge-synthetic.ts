/**
 * Purge fabricated seed listings. Run with: pnpm --filter @rmm/web db:purge-synthetic
 *
 * Safe on a durable host that already has real registrations: `.invalid`
 * emails go, operator and applicant profiles stay. Never run `db:reset`
 * afterwards — that puts the fakes back.
 */
import { purgeSyntheticProfiles } from "./purge-core"

const { removed, kept } = purgeSyntheticProfiles()
console.log(
  `Purged ${removed} fabricated seed profile${removed === 1 ? "" : "s"}. Kept ${kept} real listing${kept === 1 ? "" : "s"}. Rebuilt the match cache.`,
)
