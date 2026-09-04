"use client"

import { useT } from "@/lib/i18n/client"
import { type ClassifiedGaps, type GapField } from "@/lib/profile-form-gaps"

/**
 * Checklist after an LLM draft. Required (blocks publish) is alert-coloured;
 * optional (helps matching) is quiet ink — so finishing does not look like failure.
 */
export function GapsBanner({
  gaps,
  onDismiss,
}: {
  gaps: ClassifiedGaps
  onDismiss: () => void
}) {
  const t = useT()
  const { required, optional } = gaps
  if (required.length === 0 && optional.length === 0) return null

  return (
    <section role="status" aria-live="polite" className="border-2 border-ink bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-block bg-mark px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-mark-ink">
            {required.length > 0 ? t("form.gaps_badge") : t("form.gaps_optional_badge")}
          </p>
          <h2 className="mt-2 font-listing text-lg font-bold uppercase tracking-tight">
            {required.length > 0 ? t("form.gaps_title") : t("form.gaps_optional_title")}
          </h2>
        </div>
        <button
          type="button"
          className="text-sm font-semibold uppercase tracking-wide underline"
          onClick={onDismiss}
        >
          {t("form.gaps_dismiss")}
        </button>
      </div>

      {required.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {required.map((g) => (
            <GapChip key={g} field={g} tone="required" label={gapLabel(t, g)} />
          ))}
        </ul>
      ) : null}

      {optional.length > 0 ? (
        <div className={required.length > 0 ? "mt-4" : "mt-3"}>
          {required.length > 0 ? (
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
              {t("form.gaps_optional_title")}
            </p>
          ) : null}
          <ul className={`flex flex-wrap gap-2 ${required.length > 0 ? "mt-2" : ""}`}>
            {optional.map((g) => (
              <GapChip key={g} field={g} tone="optional" label={gapLabel(t, g)} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function GapChip({
  field,
  tone,
  label,
}: {
  field: GapField
  tone: "required" | "optional"
  label: string
}) {
  return (
    <li>
      <a
        href={`#gap-${field}`}
        className={
          tone === "required"
            ? "inline-flex border border-alert bg-paper-shade px-2 py-1 text-sm font-semibold text-alert hover:bg-alert hover:text-paper"
            : "inline-flex border border-rule bg-paper-shade px-2 py-1 text-sm text-ink-soft hover:border-ink hover:text-ink"
        }
        onClick={(e) => {
          e.preventDefault()
          document.getElementById(`gap-${field}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
        }}
      >
        {label}
      </a>
    </li>
  )
}

function gapLabel(t: (key: string) => string, g: GapField): string {
  if (g === "datasets") return t("field.datasets")
  if (g === "needs_modality") return t("field.modality")
  if (g === "needs_disease_area") return t("field.disease_area")
  if (g === "needs_min_n_subjects") return t("field.min_n_subjects")
  if (g === "needs_annotation") return t("field.annotation_required")
  return t(`field.${g}`)
}

export { findManualGaps, classifyGaps } from "@/lib/profile-form-gaps"
export type { GapField, ClassifiedGaps } from "@/lib/profile-form-gaps"
