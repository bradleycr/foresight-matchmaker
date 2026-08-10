"use client"

import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Chip, Field, Select } from "@/components/ui/primitives"

/**
 * Controlled-vocabulary form controls. Multi-value enums are chip groups —
 * every option visible, one tap to toggle, no hidden dropdown state. Single
 * enums are native selects, which work identically on a 375px phone and a
 * desktop.
 */

export function EnumChips<V extends string>({
  label,
  group,
  options,
  value,
  onChange,
  hint,
}: {
  label: string
  group: string
  options: readonly V[]
  value: V[]
  onChange: (next: V[]) => void
  hint?: string
}) {
  const t = useT()

  return (
    <Field label={label} hint={hint}>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value.includes(option)
          return (
            <Chip
              key={option}
              active={active}
              onClick={() => onChange(active ? value.filter((v) => v !== option) : [...value, option])}
            >
              {enumLabel(t, group, option)}
            </Chip>
          )
        })}
      </div>
    </Field>
  )
}

export function EnumSelect<V extends string>({
  label,
  group,
  options,
  value,
  onChange,
  allowEmpty,
  hint,
  id,
}: {
  label: string
  group: string
  options: readonly V[]
  value: V | ""
  onChange: (next: V | "") => void
  allowEmpty?: boolean
  hint?: string
  id?: string
}) {
  const t = useT()

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value as V | "")}>
        {allowEmpty && <option value="">—</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {enumLabel(t, group, option)}
          </option>
        ))}
      </Select>
    </Field>
  )
}
