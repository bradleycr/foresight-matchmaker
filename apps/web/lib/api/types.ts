import type {
  Kind,
  OrgType,
  Language,
  LookingFor,
  ApplicationStatus,
  YesNoUnsure,
  Attending,
  Visibility,
  Modality,
  DiseaseArea,
  NSubjects,
  Volume,
  Annotation,
  Linkage,
  Standards,
  Readiness,
  ConsentBasis,
  AccessModel,
  EthicsApproval,
  Methods,
  ApplicationTarget,
  ClinicalPartner,
  RegulatoryExperience,
  Compute,
  PrivacyCapability,
  TeamSize,
  IntroState,
  DeclineReason,
} from "@rmm/schema"
import type { Factor, Blocker } from "@rmm/matching"

/**
 * Client-facing shapes of the /api/v1 payloads. These mirror the schema
 * package minus every private field — the contact block and governance
 * notes never appear here because the server never sends them publicly.
 */

export interface PublicDataset {
  name: string
  modality: Modality[]
  disease_area: DiseaseArea[]
  n_subjects: NSubjects
  volume: Volume
  time_span_years?: number
  longitudinal: boolean
  annotation: Annotation
  linkage: Linkage[]
  standards: Standards[]
  readiness: Readiness
  consent_basis: ConsentBasis
  access_model: AccessModel
  data_can_leave_institution: YesNoUnsure
  ethics_approval: EthicsApproval
  available_from?: string
  publicly_describable: boolean
}

export interface DirectoryProfile {
  id: string
  slug: string
  kind: Kind
  org_name: string
  org_type: OrgType
  country: string
  eligible_hq: boolean
  partner_only: boolean
  one_liner: string
  summary: string
  website?: string
  languages: Language[]
  looking_for: LookingFor[]
  application_status: ApplicationStatus
  parallel_public_funding: YesNoUnsure
  attending: Attending[]
  open_to_intros: boolean
  visibility: Visibility
  created_at: string
  updated_at: string
  claimed_at?: string
  completeness: number
  // data_holder / consortium
  datasets?: PublicDataset[]
  // ai_team / consortium
  methods?: Methods[]
  application_target?: ApplicationTarget[]
  domain_expertise?: DiseaseArea[]
  clinical_partner?: ClinicalPartner
  regulatory_experience?: RegulatoryExperience[]
  compute?: Compute
  compute_scale?: string
  privacy_capability?: PrivacyCapability[]
  team_size?: TeamSize
  track_record?: string[]
  data_needs?: {
    modality: Modality[]
    disease_area: DiseaseArea[]
    min_n_subjects?: NSubjects
    annotation_required?: Annotation
    linkage_required: Linkage[]
    standards_preferred: Standards[]
  }
  // consortium
  still_seeking?: LookingFor[]
}

export interface DirectoryPayload {
  version: string
  generated_at: string
  profiles: DirectoryProfile[]
}

export interface MatchPayload {
  score: number
  factors: Factor[]
  blockers: Blocker[]
  computed_at: string
  /** Deterministic template prose; optional LLM polish may replace it client-side. */
  rationale: string
  profile: DirectoryProfile
}

export interface IntroPayload {
  id: string
  direction: "sent" | "received"
  state: IntroState
  message: string
  decline_reason: DeclineReason | null
  created_at: string
  responded_at: string | null
  expires_at: string
  counterpart: {
    id: string
    slug: string
    kind: Kind
    org_name: string
    country: string
    one_liner: string
    contact_name?: string
    contact_email?: string
    contact_role?: string
  } | null
}
