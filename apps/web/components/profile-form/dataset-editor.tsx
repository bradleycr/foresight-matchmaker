"use client"

import {
  MODALITY,
  DISEASE_AREA,
  N_SUBJECTS,
  VOLUME,
  ANNOTATION,
  LINKAGE,
  STANDARDS,
  READINESS,
  CONSENT_BASIS,
  ACCESS_MODEL,
  ETHICS_APPROVAL,
  YES_NO_UNSURE,
  type Dataset,
} from "@rmm/schema"
import { useT } from "@/lib/i18n/client"
import { isDatasetBlank } from "@/lib/profile-form-validate"
import { Button, Field, Input, Textarea } from "@/components/ui/primitives"
import { EnumChips, EnumSelect } from "./enum-controls"
import { cn } from "@/lib/utils"

/** A blank dataset with the safest defaults for every enum. */
export function emptyDataset(): Dataset {
  return {
    name: "",
    modality: [],
    disease_area: [],
    n_subjects: "lt_1k",
    volume: "lt_100gb",
    longitudinal: false,
    annotation: "none",
    linkage: ["none"],
    standards: ["none"],
    readiness: "raw",
    consent_basis: "unclear",
    access_model: "undecided",
    data_can_leave_institution: "unsure",
    ethics_approval: "not_started",
    publicly_describable: true,
  }
}

function datasetStatus(dataset: Dataset, t: (k: string, p?: Record<string, string | number>) => string): string[] {
  if (isDatasetBlank(dataset)) return []
  const missing: string[] = []
  if (!dataset.name.trim()) missing.push(t("form.dataset_missing_name"))
  if (dataset.modality.length === 0) missing.push(t("form.dataset_missing_modality"))
  if (dataset.disease_area.length === 0) missing.push(t("form.dataset_missing_disease"))
  return missing
}

export function DatasetEditor({
  dataset,
  index,
  onChange,
  onRemove,
  removable,
}: {
  dataset: Dataset
  index: number
  onChange: (next: Dataset) => void
  onRemove: () => void
  removable: boolean
}) {
  const t = useT()
  const set = <K extends keyof Dataset>(key: K, value: Dataset[K]) => onChange({ ...dataset, [key]: value })
  const missing = datasetStatus(dataset, t)
  const started = !isDatasetBlank(dataset)

  return (
    <fieldset
      className={cn(
        "p-4",
        started && missing.length > 0
          ? "border-2 border-alert bg-alert/5"
          : "border border-rule-strong",
      )}
    >
      <legend className="bg-mark px-2 py-0.5 font-listing text-sm font-bold uppercase text-mark-ink">
        {t("form.dataset_legend", { n: index + 1 })}
      </legend>

      {started && missing.length > 0 && (
        <p role="status" className="mt-2 border border-alert bg-alert/5 px-3 py-2 text-sm text-alert">
          {t("form.dataset_incomplete")}: {missing.join(" · ")}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <h3 className="font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">
          {t("form.dataset_section_required")}
        </h3>

        <Field label={t("field.dataset_name")} htmlFor={`ds-name-${index}`} required>
          <Input
            id={`ds-name-${index}`}
            required
            maxLength={160}
            placeholder={t("form.dataset_name_placeholder")}
            value={dataset.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <EnumChips
          label={t("field.modality")}
          group="modality"
          options={MODALITY}
          value={dataset.modality}
          onChange={(v) => set("modality", v)}
          required
          fieldId={`ds-modality-${index}`}
        />
        <EnumChips
          label={t("field.disease_area")}
          group="disease_area"
          options={DISEASE_AREA}
          value={dataset.disease_area}
          onChange={(v) => set("disease_area", v)}
          required
          fieldId={`ds-disease-${index}`}
        />

        <h3 className="mt-2 border-t border-rule pt-4 font-listing text-xs font-bold uppercase tracking-widest text-ink-soft">
          {t("form.dataset_section_optional")}
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <EnumSelect label={t("field.n_subjects")} group="n_subjects" options={N_SUBJECTS} value={dataset.n_subjects} onChange={(v) => v && set("n_subjects", v)} id={`ds-nsub-${index}`} />
          <EnumSelect label={t("field.volume")} group="volume" options={VOLUME} value={dataset.volume} onChange={(v) => v && set("volume", v)} id={`ds-vol-${index}`} />
          <Field label={t("field.time_span_years")} htmlFor={`ds-span-${index}`}>
            <Input
              id={`ds-span-${index}`}
              type="number"
              min={0}
              max={200}
              value={dataset.time_span_years ?? ""}
              onChange={(e) => set("time_span_years", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </Field>
          <EnumSelect label={t("field.annotation")} group="annotation" options={ANNOTATION} value={dataset.annotation} onChange={(v) => v && set("annotation", v)} id={`ds-ann-${index}`} />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dataset.longitudinal}
            onChange={(e) => set("longitudinal", e.target.checked)}
            className="size-5 accent-[var(--color-ink)]"
          />
          <span className="text-sm font-semibold uppercase tracking-wide">{t("field.longitudinal")}</span>
        </label>

        <EnumChips label={t("field.linkage")} group="linkage" options={LINKAGE} value={dataset.linkage} onChange={(v) => set("linkage", v)} />
        <EnumChips label={t("field.standards")} group="standards" options={STANDARDS} value={dataset.standards} onChange={(v) => set("standards", v)} />

        <div className="grid gap-4 sm:grid-cols-2">
          <EnumSelect label={t("field.readiness")} group="readiness" options={READINESS} value={dataset.readiness} onChange={(v) => v && set("readiness", v)} id={`ds-ready-${index}`} />
          <EnumSelect label={t("field.consent_basis")} group="consent_basis" options={CONSENT_BASIS} value={dataset.consent_basis} onChange={(v) => v && set("consent_basis", v)} id={`ds-consent-${index}`} />
          <EnumSelect
            label={t("field.access_model")}
            group="access_model"
            options={ACCESS_MODEL}
            value={dataset.access_model}
            onChange={(v) => v && set("access_model", v)}
            hint={t("form.access_model_hint")}
            id={`ds-access-${index}`}
          />
          <EnumSelect label={t("field.data_can_leave_institution")} group="yes_no_unsure" options={YES_NO_UNSURE} value={dataset.data_can_leave_institution} onChange={(v) => v && set("data_can_leave_institution", v)} id={`ds-leave-${index}`} />
          <EnumSelect label={t("field.ethics_approval")} group="ethics_approval" options={ETHICS_APPROVAL} value={dataset.ethics_approval} onChange={(v) => v && set("ethics_approval", v)} id={`ds-ethics-${index}`} />
          <Field label={t("field.available_from")} htmlFor={`ds-avail-${index}`}>
            <Input
              id={`ds-avail-${index}`}
              type="date"
              value={dataset.available_from ?? ""}
              onChange={(e) => set("available_from", e.target.value || undefined)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dataset.publicly_describable}
            onChange={(e) => set("publicly_describable", e.target.checked)}
            className="size-5 accent-[var(--color-ink)]"
          />
          <span className="text-sm">
            <span className="font-semibold uppercase tracking-wide">{t("field.publicly_describable")}</span>
            <span className="block text-ink-soft">{t("form.publicly_describable_hint")}</span>
          </span>
        </label>

        <Field label={t("field.governance_notes")} htmlFor={`ds-gov-${index}`} hint={t("form.private_field_hint")}>
          <Textarea
            id={`ds-gov-${index}`}
            rows={3}
            maxLength={2000}
            value={dataset.governance_notes ?? ""}
            onChange={(e) => set("governance_notes", e.target.value || undefined)}
          />
        </Field>

        {removable && (
          <Button type="button" variant="danger" onClick={onRemove} className="self-start">
            {t("form.remove_dataset")}
          </Button>
        )}
      </div>
    </fieldset>
  )
}
