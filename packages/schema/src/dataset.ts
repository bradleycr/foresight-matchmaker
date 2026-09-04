import { z } from "zod"
import {
  modalityEnum,
  diseaseAreaEnum,
  nSubjectsEnum,
  volumeEnum,
  annotationEnum,
  linkageEnum,
  standardsEnum,
  readinessEnum,
  consentBasisEnum,
  accessModelEnum,
  ethicsApprovalEnum,
  yesNoUnsureEnum,
} from "./enums"

/**
 * A dataset held by a data_holder (or embedded in a consortium).
 *
 * `governance_notes` is PRIVATE and must never appear in any public payload.
 * `publicly_describable: false` means the dataset is matched on but its detail
 * page is hidden from public view — the internal/external boundary.
 */
export const datasetSchema = z
  .object({
  name: z.string().min(1).max(160),
  modality: z.array(modalityEnum).min(1),
  modality_other: z.string().max(200).optional(),
  disease_area: z.array(diseaseAreaEnum).min(1),
  disease_area_other: z.string().max(200).optional(),
  n_subjects: nSubjectsEnum,
  volume: volumeEnum,
  time_span_years: z.number().int().nonnegative().max(200).optional(),
  longitudinal: z.boolean(),
  annotation: annotationEnum,
  linkage: z.array(linkageEnum).min(1),
  standards: z.array(standardsEnum).min(1),
  readiness: readinessEnum,
  consent_basis: consentBasisEnum,
  access_model: accessModelEnum,
  data_can_leave_institution: yesNoUnsureEnum,
  ethics_approval: ethicsApprovalEnum,
  available_from: z.string().date().optional(),
  publicly_describable: z.boolean(),
  /** PRIVATE — server-side redacted, never in public payloads. */
  governance_notes: z.string().max(2000).optional(),
})
  .superRefine((data, ctx) => {
    if (data.modality.includes("other") && !data.modality_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modality_other"],
        message: "Please define the data type.",
      })
    }
    if (data.disease_area.includes("other") && !data.disease_area_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disease_area_other"],
        message: "Please define the disease area.",
      })
    }
  })

export type Dataset = z.infer<typeof datasetSchema>

/**
 * What an AI team needs from a dataset. Mirrors the dataset shape so the
 * matcher can compare like with like.
 */
export const dataNeedsSchema = z
  .object({
    modality: z.array(modalityEnum).default([]),
    modality_other: z.string().max(200).optional(),
    disease_area: z.array(diseaseAreaEnum).default([]),
    disease_area_other: z.string().max(200).optional(),
    min_n_subjects: nSubjectsEnum.optional(),
    annotation_required: annotationEnum.optional(),
    linkage_required: z.array(linkageEnum).default([]),
    standards_preferred: z.array(standardsEnum).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.modality.includes("other") && !data.modality_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["modality_other"],
        message: "Please define the data type.",
      })
    }
    if (data.disease_area.includes("other") && !data.disease_area_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disease_area_other"],
        message: "Please define the disease area.",
      })
    }
  })

export type DataNeeds = z.infer<typeof dataNeedsSchema>
