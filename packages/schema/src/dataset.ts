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
export const datasetSchema = z.object({
  name: z.string().min(1).max(160),
  modality: z.array(modalityEnum).min(1),
  disease_area: z.array(diseaseAreaEnum).min(1),
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

export type Dataset = z.infer<typeof datasetSchema>

/**
 * What an AI team needs from a dataset. Mirrors the dataset shape so the
 * matcher can compare like with like.
 */
export const dataNeedsSchema = z.object({
  modality: z.array(modalityEnum).default([]),
  disease_area: z.array(diseaseAreaEnum).default([]),
  min_n_subjects: nSubjectsEnum.optional(),
  annotation_required: annotationEnum.optional(),
  linkage_required: z.array(linkageEnum).default([]),
  standards_preferred: z.array(standardsEnum).default([]),
})

export type DataNeeds = z.infer<typeof dataNeedsSchema>
