import { apiFetch } from "@/lib/api/server-fetch"
import type { DirectoryPayload } from "@/lib/api/types"
import { getT } from "@/lib/i18n/server"
import { DirectoryBrowser } from "@/components/directory/browser"

export const dynamic = "force-dynamic"

/**
 * The directory. The full redacted corpus is fetched server-side through the
 * public API — the same payload any external client would get — and handed
 * to the client browser whole. Filtering happens in memory; there is no
 * spinner because there is nothing to wait for.
 */
export default async function DirectoryPage() {
  const { t } = await getT()
  const directory = (await apiFetch("/api/v1/directory").then((r) => r.json())) as DirectoryPayload

  return (
    <div className="py-6">
      <h1 className="mb-4 font-listing text-3xl font-bold uppercase tracking-tight">{t("directory.title")}</h1>
      <DirectoryBrowser profiles={directory.profiles} />
    </div>
  )
}
