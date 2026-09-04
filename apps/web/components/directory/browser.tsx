"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { KIND, DISEASE_AREA, MODALITY, type Kind, type DiseaseArea, type Modality, type ChallengeId } from "@rmm/schema"
import type { DirectoryProfile } from "@/lib/api/types"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Chip, Input, Select, Tag, chipClassName } from "@/components/ui/primitives"
import { directoryHref } from "@/lib/challenges/catalog"
import { visibleChallenges } from "@/lib/challenges/visibility"

/**
 * The directory browser. One programme's redacted corpus arrives as a prop
 * from the server component — under 500 records — and every keystroke
 * filters it synchronously in memory. There is no loading state because
 * there is nothing to load.
 *
 * Filter state lives in the URL, nowhere else: ?q, ?kind, ?area, ?modality,
 * ?country. A filtered view is a link you can send to a colleague. The
 * programme itself is not a filter — it is which directory you are in, so
 * the row of programme chips navigates rather than filters.
 */

interface Filters {
  q: string
  kind: Kind | ""
  area: DiseaseArea | ""
  modality: Modality | ""
  country: string
}

/** Union of a profile's disease areas across datasets, needs, and expertise. */
function diseaseAreasOf(p: DirectoryProfile): Set<string> {
  const areas = new Set<string>()
  for (const d of p.datasets ?? []) for (const a of d.disease_area) areas.add(a)
  for (const a of p.data_needs?.disease_area ?? []) areas.add(a)
  for (const a of p.domain_expertise ?? []) areas.add(a)
  return areas
}

function modalitiesOf(p: DirectoryProfile): Set<string> {
  const modalities = new Set<string>()
  for (const d of p.datasets ?? []) for (const m of d.modality) modalities.add(m)
  for (const m of p.data_needs?.modality ?? []) modalities.add(m)
  return modalities
}

function matchesFilters(p: DirectoryProfile, f: Filters): boolean {
  if (f.kind && p.kind !== f.kind) return false
  if (f.country && p.country !== f.country) return false
  if (f.area && !diseaseAreasOf(p).has(f.area)) return false
  if (f.modality && !modalitiesOf(p).has(f.modality)) return false
  if (f.q) {
    const haystack = `${p.org_name} ${p.one_liner} ${p.summary}`.toLowerCase()
    if (!haystack.includes(f.q.toLowerCase())) return false
  }
  return true
}

/** The right-hand tabular figure for a listing row — labelled so scale and team size cannot be confused. */
function rowFigure(p: DirectoryProfile, t: ReturnType<typeof useT>): string {
  if (p.datasets && p.datasets.length > 0) {
    const biggest = p.datasets.reduce((acc, d) => {
      const order = ["lt_1k", "1k_10k", "10k_100k", "100k_1m", "gt_1m"]
      return order.indexOf(d.n_subjects) > order.indexOf(acc) ? d.n_subjects : acc
    }, p.datasets[0].n_subjects)
    return t("directory.scale_figure", {
      count: p.datasets.length,
      scale: enumLabel(t, "n_subjects", biggest),
    })
  }
  if (p.team_size) return t("directory.team_figure", { size: enumLabel(t, "team_size", p.team_size) })
  return ""
}

export function DirectoryBrowser({
  profiles,
  challengeId,
}: {
  profiles: DirectoryProfile[]
  challengeId: ChallengeId
}) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  // Sister directories to offer as tabs. With one programme there is nowhere
  // to switch to, so the row stays out of the way.
  const siblings = visibleChallenges()

  const filters: Filters = {
    q: params.get("q") ?? "",
    kind: (params.get("kind") as Kind) ?? "",
    area: (params.get("area") as DiseaseArea) ?? "",
    modality: (params.get("modality") as Modality) ?? "",
    country: params.get("country") ?? "",
  }

  function setFilter(key: keyof Filters, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const countries = useMemo(() => [...new Set(profiles.map((p) => p.country))].sort(), [profiles])

  const visible = useMemo(
    () =>
      profiles
        .filter((p) => matchesFilters(p, filters))
        .sort((a, b) => a.org_name.localeCompare(b.org_name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profiles, filters.q, filters.kind, filters.area, filters.modality, filters.country],
  )

  // Alphabetical groups with letter headers, phone-book style.
  const groups = useMemo(() => {
    const byLetter = new Map<string, DirectoryProfile[]>()
    for (const p of visible) {
      // Fold diacritics so e.g. "Öresund" files under O, phone-book style.
      const initial = p.org_name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0] ?? "#"
      const letter = /[A-Z]/i.test(initial) ? initial.toUpperCase() : "#"
      if (!byLetter.has(letter)) byLetter.set(letter, [])
      byLetter.get(letter)!.push(p)
    }
    return [...byLetter.entries()]
  }, [visible])

  const letters = groups.map(([letter]) => letter)

  return (
    <div>
      {siblings.length > 1 ? (
        <nav aria-label={t("directory.challenge_switch")} className="flex flex-wrap gap-1 border-b border-rule pb-2">
          {siblings.map((c) => (
            <Link
              key={c.id}
              href={directoryHref(c.id)}
              aria-current={c.id === challengeId ? "page" : undefined}
              className={chipClassName(c.id === challengeId)}
            >
              {enumLabel(t, "challenge", c.id)}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* Category tabs: the applicant kinds within this programme. */}
      <div
        role="tablist"
        aria-label={t("directory.kind_filter")}
        className={`flex flex-wrap gap-1 border-b-2 border-rule-strong pb-2 ${siblings.length > 1 ? "mt-2" : ""}`}
      >
        <Chip active={filters.kind === ""} onClick={() => setFilter("kind", "")}>
          {t("directory.all_kinds")} ({profiles.length})
        </Chip>
        {KIND.map((kind) => (
          <Chip key={kind} active={filters.kind === kind} onClick={() => setFilter("kind", filters.kind === kind ? "" : kind)}>
            {enumLabel(t, "kind", kind)} ({profiles.filter((p) => p.kind === kind).length})
          </Chip>
        ))}
      </div>

      {/* Search and secondary filters. */}
      <div className="grid gap-2 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          type="search"
          aria-label={t("directory.search_label")}
          placeholder={t("directory.search_placeholder")}
          defaultValue={filters.q}
          onChange={(e) => setFilter("q", e.target.value)}
        />
        <Select aria-label={t("directory.area_filter")} value={filters.area} onChange={(e) => setFilter("area", e.target.value)}>
          <option value="">{t("directory.any_area")}</option>
          {DISEASE_AREA.map((a) => (
            <option key={a} value={a}>
              {enumLabel(t, "disease_area", a)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t("directory.modality_filter")}
          value={filters.modality}
          onChange={(e) => setFilter("modality", e.target.value)}
        >
          <option value="">{t("directory.any_modality")}</option>
          {MODALITY.map((m) => (
            <option key={m} value={m}>
              {enumLabel(t, "modality", m)}
            </option>
          ))}
        </Select>
        <Select aria-label={t("directory.country_filter")} value={filters.country} onChange={(e) => setFilter("country", e.target.value)}>
          <option value="">{t("directory.any_country")}</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <p className="tnum border-b border-rule pb-2 text-sm text-ink-soft" role="status">
        {t("directory.result_count", { count: visible.length })}
      </p>

      {/* Letter jump strip — the phone's-width stand-in for the desktop thumb
          tabs below, since a fixed sidebar has nowhere to live at 390px. */}
      {letters.length > 1 && (
        <nav
          aria-label={t("directory.letter_index")}
          className="sticky top-0 z-10 -mx-4 flex gap-px overflow-x-auto border-b border-rule-strong bg-paper px-4 py-1 sm:-mx-6 sm:px-6 md:hidden"
        >
          {letters.map((letter) => (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="shrink-0 min-w-6 border-b-2 border-transparent px-1 text-center font-listing text-sm font-bold hover:border-mark"
            >
              {letter}
            </a>
          ))}
        </nav>
      )}

      <div className="relative flex gap-4">
        {/* The listings. */}
        <div className="min-w-0 flex-1">
          {visible.length === 0 ? (
            <p className="py-8 text-ink-soft">
              {profiles.length === 0 ? t("directory.empty_none") : t("directory.empty")}
            </p>
          ) : (
            groups.map(([letter, entries]) => (
              <section key={letter} id={`letter-${letter}`} aria-label={letter}>
                <h2 className="border-b-2 border-rule-strong bg-paper-shade px-2 py-1 font-listing text-lg font-bold">
                  {letter}
                </h2>
                <ul>
                  {entries.map((p) => (
                    <li key={p.id} className="border-b border-rule">
                      <Link
                        href={`/profile/${p.slug}`}
                        className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 px-2 py-2 hover:bg-paper-shade"
                      >
                        <span className="min-w-0">
                          <span className="font-listing text-base font-bold uppercase leading-tight">
                            {p.org_name}
                          </span>
                          <span className="ml-2 whitespace-nowrap text-sm text-ink-soft">{p.country}</span>
                          <Tag className="ml-2 align-middle">{enumLabel(t, "kind", p.kind)}</Tag>
                          <span className="mt-0.5 block truncate text-sm text-ink-soft">{p.one_liner}</span>
                        </span>
                        <span className="tnum whitespace-nowrap text-right font-listing text-sm">
                          {rowFigure(p, t)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {/* Thumb tabs down the edge for letter jumps — desktop only. */}
        {letters.length > 1 && (
          <nav aria-label={t("directory.letter_index")} className="sticky top-4 hidden h-fit flex-col md:flex">
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="border-l-4 border-mark bg-paper-shade px-2 py-0.5 text-center font-listing text-sm font-bold hover:bg-mark hover:text-mark-ink"
              >
                {letter}
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
