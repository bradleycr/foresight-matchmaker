"use client"

import { useT } from "@/lib/i18n/client"
import { findManualGaps, type GapField } from "@/lib/profile-form-gaps"

/** Sticky checklist of fields still empty after an LLM draft — click jumps
 * to the highlighted control so the human can finish before submit.
 */
export function GapsBanner({
  gaps,
  onDismiss,
}: {
  gaps: GapField[]
  onDismiss: () => void
}) {
  const t = useT()
  if (gaps.length === 0) return null

  return (
    <section
      role="status"
      aria-live="polite"
      className="border-2 border-alert bg-paper p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-block bg-alert px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-paper">
            {t("form.gaps_badge")}
          </p>
          <h2 className="mt-2 font-listing text-lg font-bold uppercase tracking-tight">
            {t("form.gaps_title")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{t("form.gaps_body")}</p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold uppercase tracking-wide underline"
          onClick={onDismiss}
        >
          {t("form.gaps_dismiss")}
        </button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {gaps.map((g) => (
          <li key={g}>
            <a
              href={`#gap-${g}`}
              className="inline-flex border border-alert bg-paper-shade px-2 py-1 text-sm font-semibold text-alert hover:bg-alert hover:text-paper"
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(`gap-${g}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
              }}
            >
              {gapLabel(t, g)}
            </a>
          </li>
        ))}
      </ul>
    </section>
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

/** Re-export for callers that already hold form state. */
export { findManualGaps }
export type { GapField }
