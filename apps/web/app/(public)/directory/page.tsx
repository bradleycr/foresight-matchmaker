import { apiFetch, redirectOnAuthFailure } from "@/lib/api/server-fetch"
import type { DirectoryPayload } from "@/lib/api/types"
import { getT } from "@/lib/i18n/server"
import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { signInHref } from "@/lib/auth/next-path"
import { DirectoryBrowser } from "@/components/directory/browser"

export const dynamic = "force-dynamic"

/**
 * Directory of listed organisations. Listings are redacted.
 */
export default async function DirectoryPage() {
  const session = await getSession()
  if (!session) redirect(signInHref("/directory"))

  const { t } = await getT()
  const res = await apiFetch("/api/v1/directory")
  redirectOnAuthFailure(res)
  if (!res.ok) throw new Error(`Could not load the directory (status ${res.status}).`)
  const directory = (await res.json()) as DirectoryPayload

  return (
    <div className="py-6">
      <h1 className="mb-4 font-listing text-3xl font-bold uppercase tracking-tight">{t("directory.title")}</h1>
      <DirectoryBrowser profiles={directory.profiles} />
    </div>
  )
}
