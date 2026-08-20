"use client"

import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react"
import {
  KIND,
  ORG_TYPE,
  LANGUAGE,
  LOOKING_FOR,
  APPLICATION_STATUS,
  ATTENDING,
  attendingChoices,
  isWebinarOpen,
  WEBINAR_ATTENDING,
  VISIBILITY,
  METHODS,
  APPLICATION_TARGET,
  DISEASE_AREA,
  CLINICAL_PARTNER,
  REGULATORY_EXPERIENCE,
  COMPUTE,
  PRIVACY_CAPABILITY,
  TEAM_SIZE,
  MODALITY,
  N_SUBJECTS,
  ANNOTATION,
  LINKAGE,
  STANDARDS,
  CHALLENGE_ID,
  DEFAULT_CHALLENGE_ID,
  EU_COUNTRIES,
  EFTA_COUNTRIES,
  OTHER_ELIGIBLE_COUNTRIES,
  type Kind,
  type ChallengeId,
  type Dataset,
  type Profile,
} from "@rmm/schema"
import { PLATFORM } from "@/lib/challenges/catalog"
import { useT, useLocale } from "@/lib/i18n/client"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives"
import { EnumChips, EnumSelect } from "./enum-controls"
import { DatasetEditor, emptyDataset } from "./dataset-editor"
import { PrefillBox } from "./prefill-box"
import { GapsBanner } from "./gaps-banner"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { findManualGaps, type GapField } from "@/lib/profile-form-gaps"
import { parseUrlLines, tryNormalizeUrl } from "@/lib/normalize-url"
import {
  collectValidationIssues,
  fieldIdFromApiPath,
  filterDatasetsForSubmit,
  friendlyApiMessage,
  type ValidationIssue,
} from "@/lib/profile-form-validate"
import { mergeProposalIntoForm } from "@/lib/profile-form-apply"

/**
 * The profile form — create and edit in one component. Sections appear and
 * disappear with the chosen kind. Recoding Medicine is the first programme;
 * the fields that follow are that programme's schema. Validation is the
 * server's job (the same Zod schema as the API contract); this form renders
 * whatever the server rejects, field by field.
 */

// Non-eligible countries are listed too: eligibility is derived server-side
// and the directory is allowed to contain ineligible profiles (they are
// blocked from matching, visibly).
const COUNTRY_CODES = [
  ...EU_COUNTRIES,
  ...EFTA_COUNTRIES,
  ...OTHER_ELIGIBLE_COUNTRIES,
  "US", "CA", "AU", "JP", "CN", "IN", "BR", "KR", "SG", "UA", "RS", "TR",
] as const

interface FormState {
  kind: Kind
  challenge_id: ChallengeId
  org_name: string
  org_type: (typeof ORG_TYPE)[number]
  country: string
  one_liner: string
  summary: string
  website: string
  languages: (typeof LANGUAGE)[number][]
  looking_for: (typeof LOOKING_FOR)[number][]
  looking_for_other: string
  application_status: (typeof APPLICATION_STATUS)[number]
  attending: (typeof ATTENDING)[number][]
  open_to_intros: boolean
  visibility: (typeof VISIBILITY)[number]
  partner_only: boolean
  contact_name: string
  contact_email: string
  contact_role: string
  datasets: Dataset[]
  methods: (typeof METHODS)[number][]
  methods_other: string
  application_target: (typeof APPLICATION_TARGET)[number][]
  domain_expertise: (typeof DISEASE_AREA)[number][]
  clinical_partner: (typeof CLINICAL_PARTNER)[number]
  regulatory_experience: (typeof REGULATORY_EXPERIENCE)[number][]
  compute: (typeof COMPUTE)[number]
  compute_scale: string
  privacy_capability: (typeof PRIVACY_CAPABILITY)[number][]
  team_size: (typeof TEAM_SIZE)[number]
  track_record: string
  needs_modality: (typeof MODALITY)[number][]
  needs_disease_area: (typeof DISEASE_AREA)[number][]
  needs_min_n_subjects: (typeof N_SUBJECTS)[number] | ""
  needs_annotation: (typeof ANNOTATION)[number] | ""
  needs_linkage: (typeof LINKAGE)[number][]
  needs_standards: (typeof STANDARDS)[number][]
  still_seeking: (typeof LOOKING_FOR)[number][]
  affiliation: string
  org_type_other: string
  intended_public_contribution: string
  funding_mainly_needed_for: string
  best_public_dataset: string
}

function blankState(challengeId: ChallengeId = DEFAULT_CHALLENGE_ID): FormState {
  return {
    kind: "data_holder",
    challenge_id: challengeId,
    org_name: "",
    org_type: "hospital",
    country: "DE",
    one_liner: "",
    summary: "",
    website: "",
    languages: [],
    looking_for: [],
    looking_for_other: "",
    application_status: "undecided",
    attending: [],
    open_to_intros: true,
    visibility: "authenticated_only",
    partner_only: false,
    contact_name: "",
    contact_email: "",
    contact_role: "",
    datasets: [emptyDataset()],
    methods: [],
    methods_other: "",
    application_target: [],
    domain_expertise: [],
    clinical_partner: "need",
    regulatory_experience: [],
    compute: "unsure",
    compute_scale: "",
    privacy_capability: [],
    team_size: "2_5",
    track_record: "",
    needs_modality: [],
    needs_disease_area: [],
    needs_min_n_subjects: "",
    needs_annotation: "",
    needs_linkage: [],
    needs_standards: [],
    still_seeking: [],
    affiliation: "",
    org_type_other: "",
    intended_public_contribution: "",
    funding_mainly_needed_for: "",
    best_public_dataset: "",
  }
}

function stateFromProfile(p: Profile): FormState {
  const base = blankState()
  const ai = p.kind !== "data_holder" ? p : null
  return {
    ...base,
    kind: p.kind,
    challenge_id: p.challenge_id ?? DEFAULT_CHALLENGE_ID,
    org_name: p.org_name,
    org_type: p.org_type,
    country: p.country,
    one_liner: p.one_liner,
    summary: p.summary,
    website: p.website ?? "",
    languages: p.languages,
    looking_for: p.looking_for,
    looking_for_other: p.looking_for_other ?? "",
    application_status: p.application_status,
    attending: p.attending,
    open_to_intros: p.open_to_intros,
    visibility: p.visibility,
    contact_name: p.contact_name,
    contact_email: p.contact_email,
    contact_role: p.contact_role ?? "",
    partner_only: p.partner_only ?? false,
    datasets: "datasets" in p ? p.datasets : [emptyDataset()],
    methods: ai?.methods ?? [],
    methods_other: ai?.methods_other ?? "",
    application_target: ai?.application_target ?? [],
    domain_expertise: ai?.domain_expertise ?? [],
    clinical_partner: ai?.clinical_partner ?? "need",
    regulatory_experience: ai?.regulatory_experience ?? [],
    compute: ai?.compute ?? "unsure",
    compute_scale: ai?.compute_scale ?? "",
    privacy_capability: ai?.privacy_capability ?? [],
    team_size: ai?.team_size ?? "2_5",
    track_record: (ai?.track_record ?? []).join("\n"),
    needs_modality: ai?.data_needs.modality ?? [],
    needs_disease_area: ai?.data_needs.disease_area ?? [],
    needs_min_n_subjects: ai?.data_needs.min_n_subjects ?? "",
    needs_annotation: ai?.data_needs.annotation_required ?? "",
    needs_linkage: ai?.data_needs.linkage_required ?? [],
    needs_standards: ai?.data_needs.standards_preferred ?? [],
    still_seeking: p.kind === "consortium" ? p.still_seeking : [],
    affiliation: p.kind === "individual" ? (p.affiliation ?? "") : "",
    org_type_other: p.org_type_other ?? "",
    intended_public_contribution: p.intended_public_contribution ?? "",
    funding_mainly_needed_for: p.funding_mainly_needed_for ?? "",
    best_public_dataset: p.best_public_dataset ?? "",
  }
}

/** Assemble the API payload for the current kind. */
function toPayload(s: FormState): Record<string, unknown> {
  const websiteRaw = s.website.trim()
  const website = websiteRaw ? tryNormalizeUrl(websiteRaw) ?? websiteRaw : undefined
  const { urls: trackUrls } = parseUrlLines(s.track_record)

  const shared = {
    kind: s.kind,
    challenge_id: s.challenge_id,
    org_name: s.org_name,
    org_type: s.org_type,
    country: s.country,
    one_liner: s.one_liner,
    summary: s.summary,
    website,
    languages: s.languages,
    looking_for: s.looking_for,
    looking_for_other:
      s.looking_for.includes("other") || s.still_seeking.includes("other")
        ? s.looking_for_other.trim() || undefined
        : undefined,
    application_status: s.application_status,
    parallel_public_funding: "no",
    attending: isWebinarOpen() ? s.attending : s.attending.filter((v) => v !== WEBINAR_ATTENDING),
    open_to_intros: s.open_to_intros,
    visibility: s.visibility,
    partner_only: s.partner_only,
    org_type_other: s.org_type === "other" ? s.org_type_other.trim() || undefined : undefined,
    intended_public_contribution: s.intended_public_contribution.trim() || undefined,
    funding_mainly_needed_for: s.funding_mainly_needed_for.trim() || undefined,
    best_public_dataset: s.best_public_dataset.trim() || undefined,
    contact_name: s.contact_name,
    contact_email: s.contact_email,
    contact_role: s.contact_role || undefined,
  }

  const aiFields = {
    methods: s.methods,
    methods_other: s.methods.includes("other") ? s.methods_other.trim() || undefined : undefined,
    application_target: s.application_target,
    domain_expertise: s.domain_expertise,
    clinical_partner: s.clinical_partner,
    regulatory_experience: s.regulatory_experience,
    compute: s.compute,
    compute_scale: s.compute_scale || undefined,
    privacy_capability: s.privacy_capability,
    team_size: s.team_size,
    track_record: trackUrls,
    data_needs: {
      modality: s.needs_modality,
      disease_area: s.needs_disease_area,
      min_n_subjects: s.needs_min_n_subjects || undefined,
      annotation_required: s.needs_annotation || undefined,
      linkage_required: s.needs_linkage,
      standards_preferred: s.needs_standards,
    },
  }

  if (s.kind === "data_holder") return { ...shared, datasets: filterDatasetsForSubmit(s.datasets) }
  if (s.kind === "ai_team") return { ...shared, ...aiFields }
  if (s.kind === "individual") {
    return {
      ...shared,
      ...aiFields,
      org_type: "individual",
      affiliation: s.affiliation.trim() || undefined,
    }
  }
  return { ...shared, ...aiFields, datasets: filterDatasetsForSubmit(s.datasets), still_seeking: s.still_seeking }
}

interface ApiError {
  error?: string
  details?: Array<{ path: string; message: string }>
}

/** Live form snapshot Remmy reads so it can ask about remaining gaps. */
function remmySnapshot(s: FormState): Record<string, unknown> {
  return {
    kind: s.kind,
    org_name: s.org_name,
    org_type: s.org_type,
    country: s.country,
    one_liner: s.one_liner,
    summary: s.summary,
    website: s.website,
    languages: s.languages,
    looking_for: s.looking_for,
    looking_for_other: s.looking_for_other,
    attending: s.attending,
    application_status: s.application_status,
    affiliation: s.affiliation,
    still_seeking: s.still_seeking,
    org_type_other: s.org_type_other,
    methods: s.methods,
    methods_other: s.methods_other,
    application_target: s.application_target,
    domain_expertise: s.domain_expertise,
    privacy_capability: s.privacy_capability,
    clinical_partner: s.clinical_partner,
    compute: s.compute,
    team_size: s.team_size,
    datasets: s.datasets
      .filter((d) => d.name.trim() || d.modality.length || d.disease_area.length)
      .map((d) => ({
        name: d.name,
        modality: d.modality,
        disease_area: d.disease_area,
        n_subjects: d.n_subjects,
        access_model: d.access_model,
      })),
    data_needs: {
      modality: s.needs_modality,
      disease_area: s.needs_disease_area,
      min_n_subjects: s.needs_min_n_subjects,
      annotation_required: s.needs_annotation,
    },
  }
}

function applySnapshot(base: FormState, snap?: Record<string, unknown> | null): FormState {
  if (!snap) return base
  const next = { ...base } as FormState
  const writable = next as unknown as Record<string, unknown>
  for (const key of Object.keys(base) as (keyof FormState)[]) {
    if (!(key in snap)) continue
    const incoming = snap[key as string]
    const current = base[key]
    if (Array.isArray(current)) {
      if (Array.isArray(incoming)) writable[key] = incoming
    } else if (incoming !== null && incoming !== undefined && typeof incoming === typeof current) {
      writable[key] = incoming
    }
  }
  if (!Array.isArray(next.datasets) || next.datasets.length === 0) next.datasets = base.datasets
  return next
}

export type ProfileFormHandle = {
  applyDraft: (proposal: PrefillProposal, opts?: { spotlight?: boolean }) => void
  getContext: () => { open_gaps: GapField[]; current_profile: Record<string, unknown> }
  getSnapshot: () => Record<string, unknown>
}

export function ProfileForm({
  ref,
  initial,
  profileId,
  prefillEnabled = false,
  initialProposal,
  initialSnapshot,
  highlightGapsOnMount = false,
  defaultChallengeId = DEFAULT_CHALLENGE_ID,
  lockedEmail,
  onSnapshotChange,
  onPublished,
}: {
  ref?: Ref<ProfileFormHandle>
  initial?: Profile
  profileId?: string
  prefillEnabled?: boolean
  /** Remmy (or paste-prefill) draft to apply on first mount. */
  initialProposal?: PrefillProposal
  /** Browser-restored in-progress listing (create only). */
  initialSnapshot?: Record<string, unknown> | null
  /** After a Remmy draft is applied, spotlight fields still empty. */
  highlightGapsOnMount?: boolean
  /** Programme selected on /register?challenge=… */
  defaultChallengeId?: ChallengeId
  /** Confirmed address — the listing is bound to this, not typed again. */
  lockedEmail?: string
  onSnapshotChange?: (snapshot: Record<string, unknown>) => void
  onPublished?: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const [state, setState] = useState<FormState>(() => {
    const base = initial ? stateFromProfile(initial) : blankState(defaultChallengeId)
    const restored = !initial ? applySnapshot(base, initialSnapshot) : base
    const merged = initialProposal ? mergeProposalIntoForm(restored, initialProposal, COUNTRY_CODES) : restored
    return lockedEmail ? { ...merged, contact_email: lockedEmail } : merged
  })
  const [status, setStatus] = useState<"idle" | "saving">("idle")
  const [apiError, setApiError] = useState<ApiError | null>(null)
  const [clientIssues, setClientIssues] = useState<ValidationIssue[]>([])
  const [spotlightGaps, setSpotlightGaps] = useState(highlightGapsOnMount)

  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale])
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setClientIssues([])
    setState((s) => ({ ...s, [key]: value }))
  }

  const isCreate = !profileId
  const showDatasets = state.kind === "data_holder" || state.kind === "consortium"
  const showAiFields = state.kind === "ai_team" || state.kind === "consortium" || state.kind === "individual"
  const isPerson = state.kind === "individual"

  const gaps = useMemo(() => (spotlightGaps ? findManualGaps(state) : []), [spotlightGaps, state])
  const gapSet = useMemo(() => new Set<GapField>(gaps), [gaps])
  const needs = (key: GapField) => gapSet.has(key)

  function applyDraft(proposal: PrefillProposal, opts?: { spotlight?: boolean }) {
    setState((s) => {
      const next = mergeProposalIntoForm(s, proposal, COUNTRY_CODES)
      return lockedEmail ? { ...next, contact_email: lockedEmail } : next
    })
    const spotlight = opts?.spotlight !== false
    if (spotlight) setSpotlightGaps(true)
    setClientIssues([])
    if (spotlight) {
      queueMicrotask(() => {
        document.getElementById("form-gaps")?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }

  useImperativeHandle(ref, () => ({
    applyDraft,
    getContext: () => ({
      open_gaps: findManualGaps(state),
      current_profile: remmySnapshot(state),
    }),
    getSnapshot: () => ({ ...state }) as Record<string, unknown>,
  }))

  useEffect(() => {
    onSnapshotChange?.(state as unknown as Record<string, unknown>)
  }, [state, onSnapshotChange])

  useEffect(() => {
    if (highlightGapsOnMount && gaps.length > 0) {
      document.getElementById("form-gaps")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    // Only on first mount after a Remmy confirm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setApiError(null)

    const issues = collectValidationIssues({
      kind: state.kind,
      website: state.website,
      track_record: state.track_record,
      datasets: state.datasets,
      org_type: state.org_type,
      org_type_other: state.org_type_other,
      looking_for: state.looking_for,
      still_seeking: state.still_seeking,
      looking_for_other: state.looking_for_other,
      methods: state.methods,
      methods_other: state.methods_other,
    })

    if (issues.length > 0) {
      setClientIssues(issues)
      const first = issues[0]
      document.getElementById(first.fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" })
      window.scrollTo({ top: 0 })
      return
    }

    setClientIssues([])
    setStatus("saving")

    // A dropped connection must not strand the form in "saving" — that reads as
    // a hang, and the person walks away believing they submitted. Anything
    // thrown here returns them to an editable form with their answers intact.
    let res: Response
    try {
      res = await fetch(isCreate ? "/api/v1/profiles" : `/api/v1/profiles/${profileId}`, {
        method: isCreate ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          lockedEmail ? { ...toPayload(state), contact_email: lockedEmail } : toPayload(state),
        ),
      })
    } catch {
      setApiError({ error: t("form.error_network") })
      setStatus("idle")
      window.scrollTo({ top: 0 })
      return
    }

    if (!res.ok) {
      setApiError((await res.json().catch(() => ({ error: t("form.error_generic") }))) as ApiError)
      setStatus("idle")
      window.scrollTo({ top: 0 })
      return
    }

    if (isCreate) {
      onPublished?.()
      // Publishing replaces the verified-only cookie with an owned-profile
      // session. A document navigation guarantees every cached layout,
      // especially the masthead, reads that new cookie immediately.
      window.location.assign("/me?created=1")
      return
    }
    window.location.assign("/me?saved=1")
  }

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
      {isCreate && prefillEnabled && <PrefillBox onProposal={applyDraft} />}

      {spotlightGaps && (
        <div id="form-gaps">
          <GapsBanner gaps={gaps} onDismiss={() => setSpotlightGaps(false)} />
        </div>
      )}

      {apiError && (
        <div role="alert" className="border border-alert p-4 text-alert">
          <p className="font-semibold">{apiError.error ?? t("form.error_generic")}</p>
          {apiError.details && (
            <ul className="mt-2 space-y-1">
              {apiError.details.map((d) => {
                const fieldId = fieldIdFromApiPath(d.path)
                const message = friendlyApiMessage(d.path, d.message)
                return (
                  <li key={d.path}>
                    {fieldId ? (
                      <button
                        type="button"
                        className="text-left underline"
                        onClick={() => document.getElementById(fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        {message}
                      </button>
                    ) : (
                      message
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {clientIssues.length > 0 && (
        <div role="alert" className="border border-alert p-4 text-alert">
          <p className="font-semibold">{t("form.validation.title")}</p>
          <ul className="mt-2 space-y-1">
            {clientIssues.map((issue) => (
              <li key={`${issue.fieldId}-${issue.messageKey}`}>
                <button
                  type="button"
                  className="text-left underline"
                  onClick={() => document.getElementById(issue.fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                >
                  {t(issue.messageKey, issue.params)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Programme first — schema flavour follows. Kind is fixed after create. */}
      {isCreate ? (
        <>
          <EnumChips
            label={t("field.challenge")}
            group="challenge"
            options={CHALLENGE_ID}
            value={[state.challenge_id]}
            onChange={(v) => {
              const next = v.filter((id) => id !== state.challenge_id)[0]
              if (next) set("challenge_id", next)
            }}
            hint={t("form.challenge_hint")}
          />
          <EnumChips
            label={t("field.kind")}
            group="kind"
            options={KIND}
            value={[state.kind]}
            onChange={(v) => {
              const next = v.filter((k) => k !== state.kind)[0]
              if (!next) return
              setClientIssues([])
              setState((s) => {
                if (next === "individual") {
                  return {
                    ...s,
                    kind: next,
                    org_type: "individual" as const,
                    team_size: "1" as const,
                    looking_for: s.looking_for.includes("join_team")
                      ? s.looking_for
                      : [...s.looking_for, "join_team" as const],
                  }
                }
                return {
                  ...s,
                  kind: next,
                  org_type:
                    s.org_type === "individual"
                      ? next === "ai_team"
                        ? "startup"
                        : next === "consortium"
                          ? "university"
                          : "hospital"
                      : s.org_type,
                  team_size: s.kind === "individual" ? "2_5" : s.team_size,
                }
              })
            }}
            hint={t("form.kind_hint")}
          />
        </>
      ) : (
        <div>
          <p className="text-sm text-ink-soft">
            {t("field.challenge")}: <strong className="uppercase">{t(`enum.challenge.${state.challenge_id}`)}</strong>
            {" · "}
            {t("field.kind")}: <strong className="uppercase">{t(`enum.kind.${state.kind}`)}</strong>
          </p>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{t("form.kind_locked_hint")}</p>
        </div>
      )}

      {/* Organisation. */}
      <section className="flex flex-col gap-4">
        <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t(isPerson ? "form.section_you" : "form.section_org")}
        </h2>
        <Field
          label={t(isPerson ? "field.person_name" : "field.org_name")}
          htmlFor="org_name"
          required
          attention={needs("org_name")}
          id="gap-org_name"
        >
          <Input id="org_name" required maxLength={200} value={state.org_name} onChange={(e) => set("org_name", e.target.value)} />
        </Field>
        {isPerson ? (
          <Field label={t("field.affiliation")} htmlFor="affiliation" hint={t("form.affiliation_hint")}>
            <Input id="affiliation" maxLength={200} value={state.affiliation} onChange={(e) => set("affiliation", e.target.value)} />
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {isPerson ? (
            <Field label={t("field.org_type")} htmlFor="org_type">
              <Input id="org_type" readOnly value={t("enum.org_type.individual")} />
            </Field>
          ) : (
            <EnumSelect
              label={t("field.org_type")}
              group="org_type"
              options={ORG_TYPE.filter((value) => value !== "individual")}
              value={state.org_type}
              onChange={(v) => v && set("org_type", v)}
              id="org_type"
            />
          )}
          <Field label={t("field.country")} htmlFor="country" hint={t("form.country_hint")} required>
            <Select id="country" value={state.country} onChange={(e) => set("country", e.target.value)}>
              {COUNTRY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code} — {countryNames.of(code)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!isPerson && state.org_type === "other" ? (
          <Field
            label={t("field.org_type_other")}
            htmlFor="org_type_other"
            required
            hint={t("form.org_type_other_hint")}
          >
            <Input
              id="org_type_other"
              required
              maxLength={200}
              value={state.org_type_other}
              onChange={(e) => set("org_type_other", e.target.value)}
            />
          </Field>
        ) : null}
        <Field label={t("field.one_liner")} htmlFor="one_liner" hint={t("form.one_liner_hint")} required attention={needs("one_liner")} id="gap-one_liner">
          <Input id="one_liner" required maxLength={140} value={state.one_liner} onChange={(e) => set("one_liner", e.target.value)} />
        </Field>
        <Field label={t("field.summary")} htmlFor="summary" required attention={needs("summary")} id="gap-summary">
          <Textarea id="summary" required rows={4} maxLength={600} value={state.summary} onChange={(e) => set("summary", e.target.value)} />
        </Field>
        <Field label={t("field.website")} htmlFor="website" attention={needs("website")} id="gap-website">
          <Input id="website" inputMode="url" autoComplete="url" placeholder="https://" value={state.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <EnumChips label={t("field.languages")} group="language" options={LANGUAGE} value={state.languages} onChange={(v) => set("languages", v)} attention={needs("languages")} fieldId="gap-languages" />
      </section>

      {isCreate ? (
        <section className="flex flex-col gap-4 border-2 border-ink p-4">
          <h2 className="font-listing text-xl font-bold uppercase">{t("form.section_contact")}</h2>
          <p className="text-sm leading-relaxed text-ink-soft">{t("form.draft_hint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("field.contact_name")} htmlFor="contact_name" required attention={needs("contact_name")} id="gap-contact_name">
              <Input id="contact_name" required maxLength={160} value={state.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </Field>
            <Field
              label={t("field.contact_email")}
              htmlFor="contact_email"
              required
              hint={lockedEmail ? t("form.email_locked_hint") : undefined}
              id="gap-contact_email"
            >
              <Input
                id="contact_email"
                type="email"
                required
                readOnly={Boolean(lockedEmail)}
                autoComplete={lockedEmail ? "off" : "email"}
                value={lockedEmail ?? state.contact_email}
                onChange={lockedEmail ? undefined : (e) => set("contact_email", e.target.value)}
                className={lockedEmail ? "bg-paper-shade" : undefined}
              />
            </Field>
            <Field label={t("field.contact_role")} htmlFor="contact_role">
              <Input id="contact_role" maxLength={160} value={state.contact_role} onChange={(e) => set("contact_role", e.target.value)} />
            </Field>
          </div>
        </section>
      ) : null}

      {/* Application intent. */}
      <section className="flex flex-col gap-4">
        <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t("form.section_application")}
        </h2>
        <EnumChips label={t("field.looking_for")} group="looking_for" options={LOOKING_FOR} value={state.looking_for} onChange={(v) => set("looking_for", v)} attention={needs("looking_for")} fieldId="gap-looking_for" />
        {state.looking_for.includes("other") ? (
          <Field
            label={t("field.looking_for_other")}
            htmlFor="looking_for_other"
            required
            hint={t("form.looking_for_other_hint")}
          >
            <Input
              id="looking_for_other"
              required
              maxLength={200}
              value={state.looking_for_other}
              onChange={(e) => set("looking_for_other", e.target.value)}
            />
          </Field>
        ) : null}
        <EnumSelect
          label={t("field.application_status")}
          group="application_status"
          options={APPLICATION_STATUS}
          value={state.application_status}
          onChange={(v) => v && set("application_status", v)}
          id="application_status"
        />
        <EnumChips
          label={t("field.attending")}
          group="attending"
          options={attendingChoices()}
          value={state.attending}
          onChange={(v) => set("attending", v)}
          attention={needs("attending")}
          fieldId="gap-attending"
          hint={t("form.attending_hint")}
        />
        <p className="text-sm">
          <a
            href={PLATFORM.lumaCalendarUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            {t("form.attending_events_link")}
          </a>
        </p>
      </section>

      {/* Datasets. */}
      {showDatasets && (
        <section className="flex flex-col gap-4" id="gap-datasets">
          <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
            {t("form.section_datasets")}
          </h2>
          <p className="text-sm text-ink-soft">{t("form.datasets_hint")}</p>
          {needs("datasets") && (
            <p className="border border-alert bg-alert/5 px-3 py-2 text-sm font-semibold text-alert">
              {t("form.gaps_datasets_nudge")}
            </p>
          )}
          {state.datasets.map((dataset, i) => (
            <DatasetEditor
              key={i}
              dataset={dataset}
              index={i}
              removable={state.datasets.length > 1}
              onChange={(next) => set("datasets", state.datasets.map((d, j) => (j === i ? next : d)))}
              onRemove={() => set("datasets", state.datasets.filter((_, j) => j !== i))}
            />
          ))}
          <Button type="button" onClick={() => set("datasets", [...state.datasets, emptyDataset()])} className="self-start">
            {t("form.add_dataset")}
          </Button>
          <Field label={t("field.best_public_dataset")} htmlFor="best_public_dataset" hint={t("form.best_public_dataset_hint")}>
            <Textarea
              id="best_public_dataset"
              rows={2}
              maxLength={400}
              value={state.best_public_dataset}
              onChange={(e) => set("best_public_dataset", e.target.value)}
            />
          </Field>
        </section>
      )}

      {/* AI capability. */}
      {showAiFields && (
        <section className="flex flex-col gap-4">
          <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
            {t("form.section_ai")}
          </h2>
          <EnumChips label={t("field.methods")} group="methods" options={METHODS} value={state.methods} onChange={(v) => set("methods", v)} attention={needs("methods")} fieldId="gap-methods" />
          {state.methods.includes("other") ? (
            <Field
              label={t("field.methods_other")}
              htmlFor="methods_other"
              required
              hint={t("form.methods_other_hint")}
              attention={needs("methods_other")}
              id="gap-methods_other"
            >
              <Input
                id="methods_other"
                required
                maxLength={200}
                value={state.methods_other}
                onChange={(e) => set("methods_other", e.target.value)}
              />
            </Field>
          ) : null}
          <EnumChips label={t("field.application_target")} group="application_target" options={APPLICATION_TARGET} value={state.application_target} onChange={(v) => set("application_target", v)} attention={needs("application_target")} fieldId="gap-application_target" />
          <EnumChips
            label={t("field.domain_expertise")}
            group="disease_area"
            options={DISEASE_AREA}
            value={state.domain_expertise}
            onChange={(v) => set("domain_expertise", v)}
            hint={t("form.domain_expertise_hint")}
            fieldId="gap-domain_expertise"
          />
          <EnumChips
            label={t("field.privacy_capability")}
            group="privacy_capability"
            options={PRIVACY_CAPABILITY}
            value={state.privacy_capability}
            onChange={(v) => set("privacy_capability", v)}
            hint={t("form.privacy_capability_hint")}
            attention={needs("privacy_capability")}
            fieldId="gap-privacy_capability"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <EnumSelect label={t("field.clinical_partner")} group="clinical_partner" options={CLINICAL_PARTNER} value={state.clinical_partner} onChange={(v) => v && set("clinical_partner", v)} id="clinical_partner" />
            <EnumSelect label={t("field.compute")} group="compute" options={COMPUTE} value={state.compute} onChange={(v) => v && set("compute", v)} id="compute" />
            <Field label={t("field.compute_scale")} htmlFor="compute_scale" id="gap-compute_scale">
              <Input id="compute_scale" maxLength={120} placeholder="8× H100" value={state.compute_scale} onChange={(e) => set("compute_scale", e.target.value)} />
            </Field>
            <EnumSelect label={t("field.team_size")} group="team_size" options={TEAM_SIZE} value={state.team_size} onChange={(v) => v && set("team_size", v)} id="team_size" />
          </div>
          <EnumChips label={t("field.regulatory_experience")} group="regulatory_experience" options={REGULATORY_EXPERIENCE} value={state.regulatory_experience} onChange={(v) => set("regulatory_experience", v)} />
          <Field label={t("field.track_record")} htmlFor="track_record" hint={t("form.track_record_hint")} id="gap-track_record">
            <Textarea
              id="track_record"
              rows={3}
              placeholder="https://github.com/your-org/repo"
              value={state.track_record}
              onChange={(e) => set("track_record", e.target.value)}
            />
          </Field>

          <h3 className="mt-2 border-b border-rule pb-1 font-listing text-lg font-bold uppercase">
            {t(isPerson ? "form.section_needs_person" : "form.section_needs")}
          </h3>
          <p className="text-sm text-ink-soft">{t("form.section_needs_hint")}</p>
          <EnumChips label={t("field.modality")} group="modality" options={MODALITY} value={state.needs_modality} onChange={(v) => set("needs_modality", v)} fieldId="gap-needs_modality" />
          <EnumChips label={t("field.disease_area")} group="disease_area" options={DISEASE_AREA} value={state.needs_disease_area} onChange={(v) => set("needs_disease_area", v)} fieldId="gap-needs_disease_area" />
          <div className="grid gap-4 sm:grid-cols-2">
            <EnumSelect label={t("field.min_n_subjects")} group="n_subjects" options={N_SUBJECTS} value={state.needs_min_n_subjects} onChange={(v) => set("needs_min_n_subjects", v)} allowEmpty id="needs_min_n" fieldId="gap-needs_min_n_subjects" />
            <EnumSelect label={t("field.annotation_required")} group="annotation" options={ANNOTATION} value={state.needs_annotation} onChange={(v) => set("needs_annotation", v)} allowEmpty id="needs_annotation" fieldId="gap-needs_annotation" />
          </div>
          <EnumChips label={t("field.linkage_required")} group="linkage" options={LINKAGE} value={state.needs_linkage} onChange={(v) => set("needs_linkage", v)} />
          <EnumChips label={t("field.standards_preferred")} group="standards" options={STANDARDS} value={state.needs_standards} onChange={(v) => set("needs_standards", v)} />
          {!showDatasets ? (
            <Field label={t("field.best_public_dataset")} htmlFor="best_public_dataset" hint={t("form.best_public_dataset_hint")}>
              <Textarea
                id="best_public_dataset"
                rows={2}
                maxLength={400}
                value={state.best_public_dataset}
                onChange={(e) => set("best_public_dataset", e.target.value)}
              />
            </Field>
          ) : null}
        </section>
      )}

      {state.kind === "consortium" && (
        <>
          <EnumChips label={t("field.still_seeking")} group="looking_for" options={LOOKING_FOR} value={state.still_seeking} onChange={(v) => set("still_seeking", v)} hint={t("form.still_seeking_hint")} attention={needs("still_seeking")} fieldId="gap-still_seeking" />
          {state.still_seeking.includes("other") && !state.looking_for.includes("other") ? (
            <Field
              label={t("field.looking_for_other")}
              htmlFor="looking_for_other"
              required
              hint={t("form.looking_for_other_hint")}
            >
              <Input
                id="looking_for_other"
                required
                maxLength={200}
                value={state.looking_for_other}
                onChange={(e) => set("looking_for_other", e.target.value)}
              />
            </Field>
          ) : null}
        </>
      )}

      {/* Contact — private. On create it sits with identity so a refresh can keep the draft. */}
      {!isCreate && (
        <section className="flex flex-col gap-4 border-2 border-ink p-4">
          <h2 className="font-listing text-xl font-bold uppercase">{t("form.section_contact")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("field.contact_name")} htmlFor="contact_name" required attention={needs("contact_name")} id="gap-contact_name">
              <Input id="contact_name" required maxLength={160} value={state.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </Field>
            <Field label={t("field.contact_email")} htmlFor="contact_email" required attention={needs("contact_email")} id="gap-contact_email">
              <Input id="contact_email" type="email" required value={state.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
            </Field>
            <Field label={t("field.contact_role")} htmlFor="contact_role">
              <Input id="contact_role" maxLength={160} value={state.contact_role} onChange={(e) => set("contact_role", e.target.value)} />
            </Field>
          </div>
        </section>
      )}

      {/* Visibility. */}
      <section className="flex flex-col gap-4">
        <EnumSelect label={t("field.visibility")} group="visibility" options={VISIBILITY} value={state.visibility} onChange={(v) => v && set("visibility", v)} hint={t("form.visibility_hint")} id="visibility" />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.open_to_intros}
            onChange={(e) => set("open_to_intros", e.target.checked)}
            className="size-5 accent-[var(--color-ink)]"
          />
          <span className="text-sm font-semibold uppercase tracking-wide">{t("field.open_to_intros")}</span>
        </label>
        {showAiFields && (
          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.partner_only}
                onChange={(e) => set("partner_only", e.target.checked)}
                className="size-5 accent-[var(--color-ink)]"
              />
              <span className="text-sm font-semibold uppercase tracking-wide">{t("field.partner_only")}</span>
            </span>
            <span className="pl-7 text-sm text-ink-soft">{t("form.partner_only_hint")}</span>
          </label>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t("form.section_ministry")}
        </h2>
        <Field label={t("field.intended_public_contribution")} htmlFor="intended_public_contribution">
          <Textarea
            id="intended_public_contribution"
            rows={3}
            maxLength={600}
            value={state.intended_public_contribution}
            onChange={(e) => set("intended_public_contribution", e.target.value)}
          />
        </Field>
        <Field label={t("field.funding_mainly_needed_for")} htmlFor="funding_mainly_needed_for">
          <Input
            id="funding_mainly_needed_for"
            maxLength={200}
            placeholder={t("form.funding_mainly_needed_placeholder")}
            value={state.funding_mainly_needed_for}
            onChange={(e) => set("funding_mainly_needed_for", e.target.value)}
          />
        </Field>
      </section>

      <Button type="submit" variant="primary" disabled={status === "saving"} className="self-start">
        {isCreate ? t("form.submit_create") : t("form.submit_save")}
      </Button>
    </form>
  )
}
