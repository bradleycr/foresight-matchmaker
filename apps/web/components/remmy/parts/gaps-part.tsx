"use client"

import Link from "next/link"
import { useT } from "@/lib/i18n/client"

/** Generative UI: the one field that most improves matching. */
export function GapsPart({
  nudgeKey,
  completeness,
  matchCount,
}: {
  nudgeKey: string
  completeness: number
  openToIntros: boolean
  matchCount: number
}) {
  const t = useT()
  return (
    <div className="border border-ink p-3">
      <p className="font-listing text-sm font-bold uppercase tracking-wide">{t("guide.gaps_title")}</p>
      <p className="mt-1 text-sm text-ink-soft">
        {t("guide.gaps_meta", { pct: completeness, count: matchCount })}
      </p>
      <p className="mt-2 text-sm">{t(`matches.empty_nudge.${nudgeKey}`)}</p>
      <Link
        href="/me"
        className="mt-3 inline-block border border-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
      >
        {t("matches.empty_cta")}
      </Link>
    </div>
  )
}

export function NavigatePart({ href, labelKey }: { href: string; labelKey: string }) {
  const t = useT()
  return (
    <Link
      href={href}
      className="inline-flex border border-ink bg-mark px-3 py-2 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
    >
      {t(labelKey)} →
    </Link>
  )
}
