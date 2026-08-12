"use client"

import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import type { PrefillProposal } from "@/lib/llm/prefill"

/**
 * Mandatory human checkpoint: Remmy's draft is shown as a checklist of
 * understandings. Nothing reaches the form until the user confirms.
 */
export function RemmyDraftReview({
  proposal,
  summary,
  mode,
  onConfirm,
  onRevise,
  onDiscard,
}: {
  proposal: PrefillProposal
  summary: string[]
  mode: "create" | "update"
  onConfirm: () => void
  onRevise: () => void
  onDiscard: () => void
}) {
  const t = useT()
  const lines = summary.length > 0 ? summary : fallbackSummary(proposal)

  return (
    <section
      role="region"
      aria-label={t("remmy.review_title")}
      className="border-2 border-ink bg-paper p-4"
    >
      <p className="inline-block bg-mark px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-mark-ink">
        {t("remmy.review_badge")}
      </p>
      <h2 className="mt-3 font-listing text-xl font-bold uppercase tracking-tight">{t("remmy.review_title")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {mode === "update" ? t("remmy.review_body_update") : t("remmy.review_body_create")}
      </p>

      <ul className="mt-4 space-y-2 border-t border-rule pt-3">
        {lines.map((line) => (
          <li key={line} className="flex gap-2 text-sm leading-snug">
            <span aria-hidden className="mt-0.5 font-bold text-ink">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {proposal.org_name && (
        <dl className="mt-4 grid gap-2 border border-rule bg-paper-shade p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("field.org_name")}</dt>
            <dd className="font-semibold">{proposal.org_name}</dd>
          </div>
          {proposal.kind && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("field.kind")}</dt>
              <dd className="font-semibold">{t(`enum.kind.${proposal.kind}`)}</dd>
            </div>
          )}
          {proposal.one_liner && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("field.one_liner")}</dt>
              <dd>{proposal.one_liner}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="primary" onClick={onConfirm}>
          {t("remmy.confirm")}
        </Button>
        <Button type="button" onClick={onRevise}>
          {t("remmy.revise")}
        </Button>
        <Button type="button" onClick={onDiscard}>
          {t("remmy.discard")}
        </Button>
      </div>
    </section>
  )
}

function fallbackSummary(p: PrefillProposal): string[] {
  const out: string[] = []
  if (p.kind) out.push(`Kind: ${p.kind}`)
  if (p.org_name) out.push(`Organisation: ${p.org_name}`)
  if (p.country) out.push(`Country: ${p.country}`)
  if (p.one_liner) out.push(p.one_liner)
  if (p.looking_for?.length) out.push(`Looking for: ${p.looking_for.join(", ")}`)
  if (p.methods?.length) out.push(`Methods: ${p.methods.join(", ")}`)
  if (p.datasets?.length) out.push(`Datasets drafted: ${p.datasets.length}`)
  return out.length ? out : ["Remmy prepared a draft — expand the form to inspect every field."]
}
