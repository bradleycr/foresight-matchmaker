"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Tag } from "@/components/ui/primitives"
import type { GuideMatchCard } from "@/lib/remmy/hydrate-guide"
import { ProfileContact } from "@/components/profile-contact"

/**
 * Match detail + direct contact. Bottom sheet on small screens, centred
 * panel on desktop — never nested inside the chat scroller.
 */
export function MatchSheet({
  match,
  intro,
  onClose,
}: {
  match?: GuideMatchCard
  intro?: {
    toName: string
    toSlug: string
    email?: string
    linkedin?: string
    open: boolean
  }
  onClose: () => void
}) {
  const t = useT()
  const name = match?.profile.org_name ?? intro?.toName ?? ""
  const slug = match?.profile.slug ?? intro?.toSlug ?? ""
  const email = match?.profile.contact_email ?? intro?.email
  const linkedin = match?.profile.linkedin ?? intro?.linkedin
  const open = match?.profile.open_to_intros ?? intro?.open ?? true

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    if (intro) {
      document.getElementById("match-sheet-contact")?.scrollIntoView({ block: "nearest" })
    }
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [intro, onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t("guide.close")}
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-sheet-title"
        className="relative z-10 max-h-[90vh] w-full overflow-y-auto border-t-2 border-ink bg-paper sm:max-w-lg sm:border-2"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-rule-strong px-4 py-3">
          <h2 id="match-sheet-title" className="font-listing text-xl font-bold uppercase leading-tight">
            {name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 shrink-0 px-3 text-sm font-semibold uppercase tracking-wide hover:underline"
          >
            {t("guide.close")}
          </button>
        </div>
        <div className="px-4 py-4">
          {match ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Tag>{enumLabel(t, "kind", match.profile.kind)}</Tag>
                <span className="text-sm text-ink-soft">{match.profile.country}</span>
                <span className="tnum font-listing text-2xl font-bold">{match.score}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{match.rationale}</p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide">
                  {t("guide.open_sheet")}
                </summary>
                <table className="mt-2 w-full text-sm">
                  <tbody>
                    {match.factors.map((factor) => (
                      <tr key={factor.key} className="border-b border-rule last:border-0">
                        <td className="py-1.5 pr-2">{t(`factor.${factor.key}`)}</td>
                        <td className="py-1.5 text-right">
                          {Math.round(factor.earned)}/{factor.weight}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <Link
                href={`/profile/${slug}`}
                className="mt-4 inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
              >
                {t("guide.view_profile")}
              </Link>
            </>
          ) : null}

          <div id="match-sheet-contact" className={match ? "mt-6 border-t-2 border-rule-strong pt-4" : undefined}>
            <p className="font-listing text-sm font-bold uppercase tracking-wide">{t("contact.title")}</p>
            <ProfileContact orgName={name} email={email} linkedin={linkedin} open={open} t={t} />
            {!match ? (
              <Link
                href={`/profile/${slug}#contact`}
                className="mt-3 inline-flex min-h-11 items-center px-3 text-sm font-semibold underline underline-offset-2"
              >
                {t("guide.view_profile")}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
