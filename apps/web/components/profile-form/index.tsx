"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  KIND,
  ORG_TYPE,
  LANGUAGE,
  LOOKING_FOR,
  APPLICATION_STATUS,
  YES_NO_UNSURE,
  ATTENDING,
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
  EU_COUNTRIES,
  EFTA_COUNTRIES,
  OTHER_ELIGIBLE_COUNTRIES,
  type Kind,
  type Dataset,
  type Profile,
} from "@rmm/schema"
import { useT, useLocale } from "@/lib/i18n/client"
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives"
import { EnumChips, EnumSelect } from "./enum-controls"
import { DatasetEditor, emptyDataset } from "./dataset-editor"
import { PrefillBox } from "./prefill-box"
import type { PrefillProposal } from "@/lib/llm/prefill"

/**
 * The profile form — create and edit in one component. Sections appear and
 * disappear with the chosen kind, mirroring SPRIND's three applicant
 * profiles. Validation is the server's job (the same Zod schema as the API
 * contract); this form renders whatever the server rejects, field by field.
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
  org_name: string
  org_type: (typeof ORG_TYPE)[number]
  country: string
  one_liner: string
  summary: string
  website: string
  languages: (typeof LANGUAGE)[number][]
  looking_for: (typeof LOOKING_FOR)[number][]
  application_status: (typeof APPLICATION_STATUS)[number]
  parallel_public_funding: (typeof YES_NO_UNSURE)[number]
  attending: (typeof ATTENDING)[number][]
  open_to_intros: boolean
  visibility: (typeof VISIBILITY)[number]
  partner_only: boolean
  contact_name: string
  contact_email: string
  contact_role: string
  datasets: Dataset[]
  methods: (typeof METHODS)[number][]
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
}

function blankState(): FormState {
  return {
    kind: "data_holder",
    org_name: "",
    org_type: "hospital",
    country: "DE",
    one_liner: "",
    summary: "",
    website: "",
    languages: [],
    looking_for: [],
    application_status: "undecided",
    parallel_public_funding: "no",
    attending: [],
    open_to_intros: true,
    visibility: "public",
    partner_only: false,
    contact_name: "",
    contact_email: "",
    contact_role: "",
    datasets: [emptyDataset()],
    methods: [],
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
  }
}

function stateFromProfile(p: Profile): FormState {
  const base = blankState()
  const ai = p.kind !== "data_holder" ? p : null
  return {
    ...base,
    kind: p.kind,
    org_name: p.org_name,
    org_type: p.org_type,
    country: p.country,
    one_liner: p.one_liner,
    summary: p.summary,
    website: p.website ?? "",
    languages: p.languages,
    looking_for: p.looking_for,
    application_status: p.application_status,
    parallel_public_funding: p.parallel_public_funding,
    attending: p.attending,
    open_to_intros: p.open_to_intros,
    visibility: p.visibility,
    contact_name: p.contact_name,
    contact_email: p.contact_email,
    contact_role: p.contact_role ?? "",
    partner_only: p.partner_only ?? false,
    datasets: "datasets" in p ? p.datasets : [emptyDataset()],
    methods: ai?.methods ?? [],
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
  }
}

/** Assemble the API payload for the current kind. */
function toPayload(s: FormState): Record<string, unknown> {
  const shared = {
    kind: s.kind,
    org_name: s.org_name,
    org_type: s.org_type,
    country: s.country,
    one_liner: s.one_liner,
    summary: s.summary,
    website: s.website || undefined,
    languages: s.languages,
    looking_for: s.looking_for,
    application_status: s.application_status,
    parallel_public_funding: s.parallel_public_funding,
    attending: s.attending,
    open_to_intros: s.open_to_intros,
    visibility: s.visibility,
    partner_only: s.partner_only,
    contact_name: s.contact_name,
    contact_email: s.contact_email,
    contact_role: s.contact_role || undefined,
  }

  const aiFields = {
    methods: s.methods,
    application_target: s.application_target,
    domain_expertise: s.domain_expertise,
    clinical_partner: s.clinical_partner,
    regulatory_experience: s.regulatory_experience,
    compute: s.compute,
    compute_scale: s.compute_scale || undefined,
    privacy_capability: s.privacy_capability,
    team_size: s.team_size,
    track_record: s.track_record.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5),
    data_needs: {
      modality: s.needs_modality,
      disease_area: s.needs_disease_area,
      min_n_subjects: s.needs_min_n_subjects || undefined,
      annotation_required: s.needs_annotation || undefined,
      linkage_required: s.needs_linkage,
      standards_preferred: s.needs_standards,
    },
  }

  if (s.kind === "data_holder") return { ...shared, datasets: s.datasets }
  if (s.kind === "ai_team") return { ...shared, ...aiFields }
  return { ...shared, ...aiFields, datasets: s.datasets, still_seeking: s.still_seeking }
}

/**
 * Merge an LLM proposal into the form state. Only fields the proposal
 * actually contains are applied; everything else keeps its current value.
 * The user reviews the whole form before anything is saved.
 */
function applyProposal(s: FormState, p: PrefillProposal): FormState {
  const next = { ...s }

  if (p.kind) next.kind = p.kind
  if (p.org_name) next.org_name = p.org_name
  if (p.org_type) next.org_type = p.org_type
  if (p.country && (COUNTRY_CODES as readonly string[]).includes(p.country)) next.country = p.country
  if (p.one_liner) next.one_liner = p.one_liner
  if (p.summary) next.summary = p.summary
  if (p.website) next.website = p.website
  if (p.languages.length) next.languages = p.languages
  if (p.looking_for.length) next.looking_for = p.looking_for
  if (p.methods.length) next.methods = p.methods
  if (p.application_target.length) next.application_target = p.application_target
  if (p.domain_expertise.length) next.domain_expertise = p.domain_expertise
  if (p.clinical_partner) next.clinical_partner = p.clinical_partner
  if (p.regulatory_experience.length) next.regulatory_experience = p.regulatory_experience
  if (p.compute) next.compute = p.compute
  if (p.privacy_capability.length) next.privacy_capability = p.privacy_capability
  if (p.team_size) next.team_size = p.team_size
  if (p.track_record.length) next.track_record = p.track_record.join("\n")

  if (p.data_needs) {
    if (p.data_needs.modality.length) next.needs_modality = p.data_needs.modality
    if (p.data_needs.disease_area.length) next.needs_disease_area = p.data_needs.disease_area
    if (p.data_needs.min_n_subjects) next.needs_min_n_subjects = p.data_needs.min_n_subjects
    if (p.data_needs.annotation_required) next.needs_annotation = p.data_needs.annotation_required
    if (p.data_needs.linkage_required.length) next.needs_linkage = p.data_needs.linkage_required
    if (p.data_needs.standards_preferred.length) next.needs_standards = p.data_needs.standards_preferred
  }

  if (p.datasets.length) {
    // Partial dataset proposals are laid over blank-dataset defaults.
    next.datasets = p.datasets.map((d) => ({
      ...emptyDataset(),
      ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)),
    }))
  }

  return next
}

interface ApiError {
  error?: string
  details?: Array<{ path: string; message: string }>
}

export function ProfileForm({
  initial,
  profileId,
  prefillEnabled = false,
}: {
  initial?: Profile
  profileId?: string
  prefillEnabled?: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [state, setState] = useState<FormState>(() => (initial ? stateFromProfile(initial) : blankState()))
  const [status, setStatus] = useState<"idle" | "saving" | "created">("idle")
  const [claimLink, setClaimLink] = useState<string | null>(null)
  const [apiError, setApiError] = useState<ApiError | null>(null)

  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale])
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((s) => ({ ...s, [key]: value }))

  const isCreate = !profileId
  const showDatasets = state.kind === "data_holder" || state.kind === "consortium"
  const showAiFields = state.kind === "ai_team" || state.kind === "consortium"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("saving")
    setApiError(null)

    const res = await fetch(isCreate ? "/api/v1/profiles" : `/api/v1/profiles/${profileId}`, {
      method: isCreate ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(state)),
    })

    if (!res.ok) {
      setApiError((await res.json().catch(() => ({ error: t("form.error_generic") }))) as ApiError)
      setStatus("idle")
      window.scrollTo({ top: 0 })
      return
    }

    if (isCreate) {
      const body = (await res.json()) as { claim_link?: string }
      setClaimLink(body.claim_link ?? null)
      setStatus("created")
      window.scrollTo({ top: 0 })
    } else {
      router.push("/me?saved=1")
      router.refresh()
    }
  }

  if (status === "created") {
    return (
      <div className="border border-ink bg-paper-shade p-6">
        <h2 className="font-listing text-2xl font-bold uppercase">{t("form.created_title")}</h2>
        <p className="mt-2">{t("form.created_body")}</p>
        {claimLink && (
          <div className="mt-4 border border-ink bg-paper p-4">
            <p className="font-semibold">{t("signin.copy_link_warning")}</p>
            <p className="mt-2 break-all">
              <a href={claimLink} className="tnum underline">
                {claimLink}
              </a>
            </p>
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <Button variant="primary" onClick={() => router.push("/me/matches")}>
            {t("form.created_cta_matches")}
          </Button>
          <Button onClick={() => router.push("/directory")}>{t("nav.directory")}</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
      {isCreate && prefillEnabled && <PrefillBox onProposal={(p) => setState((s) => applyProposal(s, p))} />}

      {apiError && (
        <div role="alert" className="border border-alert p-4 text-alert">
          <p className="font-semibold">{apiError.error ?? t("form.error_generic")}</p>
          {apiError.details && (
            <ul className="mt-2 list-inside list-disc">
              {apiError.details.map((d) => (
                <li key={d.path}>
                  <span className="font-listing">{d.path}</span>: {d.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Kind — fixed after creation. */}
      {isCreate ? (
        <EnumChips
          label={t("field.kind")}
          group="kind"
          options={KIND}
          value={[state.kind]}
          onChange={(v) => {
            const next = v.filter((k) => k !== state.kind)[0]
            if (next) set("kind", next)
          }}
          hint={t("form.kind_hint")}
        />
      ) : (
        <p className="text-sm text-ink-soft">
          {t("field.kind")}: <strong className="uppercase">{t(`enum.kind.${state.kind}`)}</strong>
        </p>
      )}

      {/* Organisation. */}
      <section className="flex flex-col gap-4">
        <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t("form.section_org")}
        </h2>
        <Field label={t("field.org_name")} htmlFor="org_name" required>
          <Input id="org_name" required maxLength={200} value={state.org_name} onChange={(e) => set("org_name", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <EnumSelect label={t("field.org_type")} group="org_type" options={ORG_TYPE} value={state.org_type} onChange={(v) => v && set("org_type", v)} id="org_type" />
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
        <Field label={t("field.one_liner")} htmlFor="one_liner" hint={t("form.one_liner_hint")} required>
          <Input id="one_liner" required maxLength={140} value={state.one_liner} onChange={(e) => set("one_liner", e.target.value)} />
        </Field>
        <Field label={t("field.summary")} htmlFor="summary" required>
          <Textarea id="summary" required rows={4} maxLength={600} value={state.summary} onChange={(e) => set("summary", e.target.value)} />
        </Field>
        <Field label={t("field.website")} htmlFor="website">
          <Input id="website" type="url" placeholder="https://" value={state.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <EnumChips label={t("field.languages")} group="language" options={LANGUAGE} value={state.languages} onChange={(v) => set("languages", v)} />
      </section>

      {/* Application intent. */}
      <section className="flex flex-col gap-4">
        <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
          {t("form.section_application")}
        </h2>
        <EnumChips label={t("field.looking_for")} group="looking_for" options={LOOKING_FOR} value={state.looking_for} onChange={(v) => set("looking_for", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <EnumSelect label={t("field.application_status")} group="application_status" options={APPLICATION_STATUS} value={state.application_status} onChange={(v) => v && set("application_status", v)} id="application_status" />
          <EnumSelect
            label={t("field.parallel_public_funding")}
            group="yes_no_unsure"
            options={YES_NO_UNSURE}
            value={state.parallel_public_funding}
            onChange={(v) => v && set("parallel_public_funding", v)}
            hint={t("form.parallel_funding_hint")}
            id="parallel_public_funding"
          />
        </div>
        <EnumChips label={t("field.attending")} group="attending" options={ATTENDING} value={state.attending} onChange={(v) => set("attending", v)} />
      </section>

      {/* Datasets. */}
      {showDatasets && (
        <section className="flex flex-col gap-4">
          <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
            {t("form.section_datasets")}
          </h2>
          <p className="text-sm text-ink-soft">{t("form.datasets_hint")}</p>
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
        </section>
      )}

      {/* AI capability. */}
      {showAiFields && (
        <section className="flex flex-col gap-4">
          <h2 className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
            {t("form.section_ai")}
          </h2>
          <EnumChips label={t("field.methods")} group="methods" options={METHODS} value={state.methods} onChange={(v) => set("methods", v)} />
          <EnumChips label={t("field.application_target")} group="application_target" options={APPLICATION_TARGET} value={state.application_target} onChange={(v) => set("application_target", v)} />
          <EnumChips label={t("field.domain_expertise")} group="disease_area" options={DISEASE_AREA} value={state.domain_expertise} onChange={(v) => set("domain_expertise", v)} />
          <EnumChips
            label={t("field.privacy_capability")}
            group="privacy_capability"
            options={PRIVACY_CAPABILITY}
            value={state.privacy_capability}
            onChange={(v) => set("privacy_capability", v)}
            hint={t("form.privacy_capability_hint")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <EnumSelect label={t("field.clinical_partner")} group="clinical_partner" options={CLINICAL_PARTNER} value={state.clinical_partner} onChange={(v) => v && set("clinical_partner", v)} id="clinical_partner" />
            <EnumSelect label={t("field.compute")} group="compute" options={COMPUTE} value={state.compute} onChange={(v) => v && set("compute", v)} id="compute" />
            <Field label={t("field.compute_scale")} htmlFor="compute_scale">
              <Input id="compute_scale" maxLength={120} placeholder="8× H100" value={state.compute_scale} onChange={(e) => set("compute_scale", e.target.value)} />
            </Field>
            <EnumSelect label={t("field.team_size")} group="team_size" options={TEAM_SIZE} value={state.team_size} onChange={(v) => v && set("team_size", v)} id="team_size" />
          </div>
          <EnumChips label={t("field.regulatory_experience")} group="regulatory_experience" options={REGULATORY_EXPERIENCE} value={state.regulatory_experience} onChange={(v) => set("regulatory_experience", v)} />
          <Field label={t("field.track_record")} htmlFor="track_record" hint={t("form.track_record_hint")}>
            <Textarea id="track_record" rows={3} value={state.track_record} onChange={(e) => set("track_record", e.target.value)} />
          </Field>

          <h3 className="mt-2 border-b border-rule pb-1 font-listing text-lg font-bold uppercase">
            {t("form.section_needs")}
          </h3>
          <EnumChips label={t("field.modality")} group="modality" options={MODALITY} value={state.needs_modality} onChange={(v) => set("needs_modality", v)} />
          <EnumChips label={t("field.disease_area")} group="disease_area" options={DISEASE_AREA} value={state.needs_disease_area} onChange={(v) => set("needs_disease_area", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <EnumSelect label={t("field.min_n_subjects")} group="n_subjects" options={N_SUBJECTS} value={state.needs_min_n_subjects} onChange={(v) => set("needs_min_n_subjects", v)} allowEmpty id="needs_min_n" />
            <EnumSelect label={t("field.annotation_required")} group="annotation" options={ANNOTATION} value={state.needs_annotation} onChange={(v) => set("needs_annotation", v)} allowEmpty id="needs_annotation" />
          </div>
          <EnumChips label={t("field.linkage_required")} group="linkage" options={LINKAGE} value={state.needs_linkage} onChange={(v) => set("needs_linkage", v)} />
          <EnumChips label={t("field.standards_preferred")} group="standards" options={STANDARDS} value={state.needs_standards} onChange={(v) => set("needs_standards", v)} />
        </section>
      )}

      {state.kind === "consortium" && (
        <EnumChips label={t("field.still_seeking")} group="looking_for" options={LOOKING_FOR} value={state.still_seeking} onChange={(v) => set("still_seeking", v)} hint={t("form.still_seeking_hint")} />
      )}

      {/* Contact — private, always. */}
      <section className="flex flex-col gap-4 border-2 border-ink p-4">
        <h2 className="font-listing text-xl font-bold uppercase">{t("form.section_contact")}</h2>
        <p className="text-sm text-ink-soft">{t("form.contact_privacy_note")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("field.contact_name")} htmlFor="contact_name" required>
            <Input id="contact_name" required maxLength={160} value={state.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label={t("field.contact_email")} htmlFor="contact_email" required>
            <Input id="contact_email" type="email" required value={state.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </Field>
          <Field label={t("field.contact_role")} htmlFor="contact_role">
            <Input id="contact_role" maxLength={160} value={state.contact_role} onChange={(e) => set("contact_role", e.target.value)} />
          </Field>
        </div>
      </section>

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

      <Button type="submit" variant="primary" disabled={status === "saving"} className="self-start">
        {isCreate ? t("form.submit_create") : t("form.submit_save")}
      </Button>
    </form>
  )
}
