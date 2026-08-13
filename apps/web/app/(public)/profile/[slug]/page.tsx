import { notFound, redirect } from "next/navigation"
import { apiFetch, redirectOnAuthFailure } from "@/lib/api/server-fetch"
import type { DirectoryPayload, PublicDataset } from "@/lib/api/types"
import { getSession } from "@/lib/auth/session"
import { getT } from "@/lib/i18n/server"
import { enumLabel } from "@/lib/i18n/labels"
import { Tag } from "@/components/ui/primitives"
import { IntroRequestForm } from "@/components/intro-request-form"
import type { T } from "@/lib/i18n"
import { challengeById, challengeIdOf } from "@/lib/challenges/catalog"
import { signInHref } from "@/lib/auth/next-path"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ slug: string }> }

/** label/value row in the two-tier directory hierarchy. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 border-b border-rule py-1.5 sm:grid-cols-[14rem_1fr]">
      <dt className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="tnum text-base">{children}</dd>
    </div>
  )
}

function joinEnum(t: T, group: string, values: readonly string[] | undefined): string {
  if (!values || values.length === 0) return "—"
  return values.map((v) => enumLabel(t, group, v)).join(", ")
}

function DatasetBlock({ dataset, t }: { dataset: PublicDataset; t: T }) {
  return (
    <section aria-label={dataset.name} className="mt-4 border border-rule-strong">
      <h3 className="border-b-2 border-rule-strong bg-paper-shade px-3 py-1.5 font-listing text-lg font-bold uppercase">
        {dataset.name}
      </h3>
      <dl className="px-3 pb-2">
        <Row label={t("field.modality")}>{joinEnum(t, "modality", dataset.modality)}</Row>
        <Row label={t("field.disease_area")}>{joinEnum(t, "disease_area", dataset.disease_area)}</Row>
        <Row label={t("field.n_subjects")}>{enumLabel(t, "n_subjects", dataset.n_subjects)}</Row>
        <Row label={t("field.volume")}>{enumLabel(t, "volume", dataset.volume)}</Row>
        {dataset.time_span_years !== undefined && (
          <Row label={t("field.time_span_years")}>{dataset.time_span_years}</Row>
        )}
        <Row label={t("field.longitudinal")}>{dataset.longitudinal ? t("common.yes") : t("common.no")}</Row>
        <Row label={t("field.annotation")}>{enumLabel(t, "annotation", dataset.annotation)}</Row>
        <Row label={t("field.linkage")}>{joinEnum(t, "linkage", dataset.linkage)}</Row>
        <Row label={t("field.standards")}>{joinEnum(t, "standards", dataset.standards)}</Row>
        <Row label={t("field.readiness")}>{enumLabel(t, "readiness", dataset.readiness)}</Row>
        <Row label={t("field.consent_basis")}>{enumLabel(t, "consent_basis", dataset.consent_basis)}</Row>
        <Row label={t("field.access_model")}>{enumLabel(t, "access_model", dataset.access_model)}</Row>
        <Row label={t("field.data_can_leave_institution")}>
          {enumLabel(t, "yes_no_unsure", dataset.data_can_leave_institution)}
        </Row>
        <Row label={t("field.ethics_approval")}>{enumLabel(t, "ethics_approval", dataset.ethics_approval)}</Row>
        {dataset.available_from && <Row label={t("field.available_from")}>{dataset.available_from}</Row>}
      </dl>
    </section>
  )
}

export default async function ProfilePage({ params }: Params) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect(signInHref(`/profile/${slug}`))

  const { t } = await getT()

  const res = await apiFetch("/api/v1/directory")
  redirectOnAuthFailure(res)
  if (!res.ok) throw new Error(`Could not load the directory (status ${res.status}).`)
  const directory = (await res.json()) as DirectoryPayload
  const profile = directory.profiles.find((p) => p.slug === slug)
  if (!profile) notFound()

  const isOwn = session?.profileId === profile.id

  return (
    <article className="max-w-3xl py-6">
      <header className="border-b-2 border-rule-strong pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{enumLabel(t, "kind", profile.kind)}</Tag>
          <Tag>
            <a href={`/challenges/${challengeById(profile.challenge_id).slug}`} className="hover:underline">
              {enumLabel(t, "challenge", challengeIdOf(profile.challenge_id))}
            </a>
          </Tag>
          <span className="text-sm text-ink-soft">
            {profile.country} · {enumLabel(t, "org_type", profile.org_type)}
          </span>
        </div>
        <h1 className="mt-2 font-listing text-3xl font-bold uppercase leading-tight tracking-tight sm:text-4xl">
          {profile.org_name}
        </h1>
        <p className="mt-2 text-lg">{profile.one_liner}</p>
      </header>

      <p className="mt-4 leading-relaxed">{profile.summary}</p>

      <dl className="mt-6">
        {profile.website && (
          <Row label={t("field.website")}>
            <a href={profile.website} className="underline" rel="noopener noreferrer">
              {profile.website}
            </a>
          </Row>
        )}
        <Row label={t("field.languages")}>{joinEnum(t, "language", profile.languages)}</Row>
        <Row label={t("field.looking_for")}>{joinEnum(t, "looking_for", profile.looking_for)}</Row>
        <Row label={t("field.application_status")}>
          {enumLabel(t, "application_status", profile.application_status)}
        </Row>
        <Row label={t("field.attending")}>{joinEnum(t, "attending", profile.attending)}</Row>
      </dl>

      {/* AI capability block (ai_team and consortium). */}
      {profile.methods && (
        <section aria-labelledby="ai-fields" className="mt-8">
          <h2 id="ai-fields" className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
            {t("profile.ai_section")}
          </h2>
          <dl>
            <Row label={t("field.methods")}>{joinEnum(t, "methods", profile.methods)}</Row>
            <Row label={t("field.application_target")}>
              {joinEnum(t, "application_target", profile.application_target)}
            </Row>
            <Row label={t("field.domain_expertise")}>{joinEnum(t, "disease_area", profile.domain_expertise)}</Row>
            {profile.clinical_partner && (
              <Row label={t("field.clinical_partner")}>
                {enumLabel(t, "clinical_partner", profile.clinical_partner)}
              </Row>
            )}
            <Row label={t("field.regulatory_experience")}>
              {joinEnum(t, "regulatory_experience", profile.regulatory_experience)}
            </Row>
            {profile.compute && <Row label={t("field.compute")}>{enumLabel(t, "compute", profile.compute)}</Row>}
            {profile.compute_scale && <Row label={t("field.compute_scale")}>{profile.compute_scale}</Row>}
            <Row label={t("field.privacy_capability")}>
              {joinEnum(t, "privacy_capability", profile.privacy_capability)}
            </Row>
            {profile.team_size && <Row label={t("field.team_size")}>{enumLabel(t, "team_size", profile.team_size)}</Row>}
            {profile.track_record && profile.track_record.length > 0 && (
              <Row label={t("field.track_record")}>
                <ul>
                  {profile.track_record.map((url) => (
                    <li key={url}>
                      <a href={url} className="underline" rel="noopener noreferrer">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Row>
            )}
          </dl>

          {profile.data_needs && (
            <>
              <h2 className="mt-6 border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
                {t("profile.needs_section")}
              </h2>
              <dl>
                <Row label={t("field.modality")}>{joinEnum(t, "modality", profile.data_needs.modality)}</Row>
                <Row label={t("field.disease_area")}>
                  {joinEnum(t, "disease_area", profile.data_needs.disease_area)}
                </Row>
                {profile.data_needs.min_n_subjects && (
                  <Row label={t("field.min_n_subjects")}>
                    {enumLabel(t, "n_subjects", profile.data_needs.min_n_subjects)}
                  </Row>
                )}
                {profile.data_needs.annotation_required && (
                  <Row label={t("field.annotation_required")}>
                    {enumLabel(t, "annotation", profile.data_needs.annotation_required)}
                  </Row>
                )}
                <Row label={t("field.linkage_required")}>
                  {joinEnum(t, "linkage", profile.data_needs.linkage_required)}
                </Row>
                <Row label={t("field.standards_preferred")}>
                  {joinEnum(t, "standards", profile.data_needs.standards_preferred)}
                </Row>
              </dl>
            </>
          )}
        </section>
      )}

      {/* Datasets (data_holder and consortium). Only publicly-describable ones arrive here. */}
      {profile.datasets && profile.datasets.length > 0 && (
        <section aria-labelledby="datasets" className="mt-8">
          <h2 id="datasets" className="border-b-2 border-rule-strong pb-1 font-listing text-xl font-bold uppercase">
            {t("profile.datasets_section", { count: profile.datasets.length })}
          </h2>
          {profile.datasets.map((d) => (
            <DatasetBlock key={d.name} dataset={d} t={t} />
          ))}
        </section>
      )}

      {profile.still_seeking && profile.still_seeking.length > 0 && (
        <p className="mt-6 border border-ink px-3 py-2">
          <strong className="uppercase">{t("profile.still_seeking")}: </strong>
          {joinEnum(t, "looking_for", profile.still_seeking)}
        </p>
      )}

      {/* Contact is emailed off-platform; this site keeps a record. */}
      {!isOwn && (
        <section aria-labelledby="intro" className="mt-10 border-t-2 border-rule-strong pt-4">
          <h2 id="intro" className="font-listing text-xl font-bold uppercase">
            {t("intro.request_title")}
          </h2>
          {profile.open_to_intros ? (
            <IntroRequestForm targetId={profile.id} targetName={profile.org_name} signedIn />
          ) : (
            <p className="mt-2 text-ink-soft">{t("intro.not_open")}</p>
          )}
        </section>
      )}
    </article>
  )
}
