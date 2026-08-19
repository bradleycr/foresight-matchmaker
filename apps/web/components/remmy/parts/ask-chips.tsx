"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Button, Chip } from "@/components/ui/primitives"
import { ASK_CATALOG, type AskId } from "@/lib/remmy/ask"

/**
 * Generative UI: Remmy names a vocabulary, this renders the real options.
 * Single-select (kind) commits on tap. Multi-select waits for Add these.
 */
export function AskChipsPart({
  ask,
  disabled,
  onCommit,
  onSkip,
}: {
  ask: AskId
  disabled?: boolean
  onCommit: (values: string[]) => void
  onSkip: () => void
}) {
  const t = useT()
  const catalog = ASK_CATALOG[ask]
  const [picked, setPicked] = useState<string[]>([])

  function toggle(option: string) {
    if (disabled) return
    if (!catalog.multi) {
      onCommit([option])
      return
    }
    setPicked((cur) => (cur.includes(option) ? cur.filter((v) => v !== option) : [...cur, option]))
  }

  return (
    <div className="mt-3 border border-ink bg-paper p-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">{t(catalog.labelKey)}</p>
      <div role="group" aria-label={t(catalog.labelKey)} className="mt-2 flex flex-wrap gap-1.5">
        {catalog.options.map((option) => (
          <Chip key={option} active={picked.includes(option)} disabled={disabled} onClick={() => toggle(option)}>
            {enumLabel(t, catalog.group, option)}
          </Chip>
        ))}
      </div>
      {catalog.multi && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            className="text-sm"
            disabled={disabled || picked.length === 0}
            onClick={() => onCommit(picked)}
          >
            {t("remmy.ask_add")}
          </Button>
          <Button type="button" className="text-sm" disabled={disabled} onClick={onSkip}>
            {t("remmy.ask_skip")}
          </Button>
        </div>
      )}
    </div>
  )
}
