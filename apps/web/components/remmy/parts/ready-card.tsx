"use client"

import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"

/**
 * Finish line after required fields are in. Code decides this, not the model.
 * Three actions, almost no copy — publish, add optional, or open the form.
 */
export function ProfileReadyCard({
  oneLiner,
  summary,
  onPublish,
  onMore,
  onForm,
}: {
  oneLiner?: string
  summary?: string
  onPublish: () => void
  onMore: () => void
  onForm: () => void
}) {
  const t = useT()

  return (
    <div className="border-2 border-ink bg-mark/30 px-3 py-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">{t("remmy.ready_kicker")}</p>
      {oneLiner ? <p className="mt-2 text-sm font-semibold leading-snug">{oneLiner}</p> : null}
      {summary ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{summary}</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="primary" className="text-sm" onClick={onPublish}>
          {t("remmy.ready_publish")}
        </Button>
        <Button type="button" className="text-sm" onClick={onMore}>
          {t("remmy.ready_more")}
        </Button>
        <Button type="button" variant="ghost" className="text-sm" onClick={onForm}>
          {t("remmy.ready_form")}
        </Button>
      </div>
    </div>
  )
}
