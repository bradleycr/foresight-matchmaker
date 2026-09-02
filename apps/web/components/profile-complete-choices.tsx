import Link from "next/link"
import type { Profile } from "@rmm/schema"
import type { T } from "@/lib/i18n"
import { browseDirectoryPath } from "@/lib/challenges/catalog"

/**
 * A deliberate hand-off from profile creation into matchmaking.
 *
 * Keeping this separate from the editor makes completion feel like a real
 * milestone and gives first-time participants one clear next decision.
 */
export function ProfileCompleteChoices({ profile, t }: { profile: Profile; t: T }) {
  return (
    <section aria-labelledby="profile-complete-title" className="mx-auto max-w-4xl py-8 sm:py-14">
      <h1
        id="profile-complete-title"
        className="mt-2 max-w-3xl font-listing text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl"
      >
        {t("me.complete_title")}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed">
        {t("me.complete_body", { name: profile.org_name })}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/me/matches"
          className="group border-2 border-ink bg-mark p-5 text-mark-ink hover:bg-ink hover:text-paper sm:p-6"
        >
          <p className="text-xs font-bold uppercase tracking-widest">{t("me.complete_recommended")}</p>
          <h2 className="mt-3 font-listing text-2xl font-bold uppercase tracking-tight">
            {t("me.complete_matches_title")}
          </h2>
          <p className="mt-2 leading-relaxed">{t("me.complete_matches_body")}</p>
          <p className="mt-5 text-sm font-semibold uppercase tracking-wide underline underline-offset-2">
            {t("me.complete_matches_cta")} →
          </p>
        </Link>

        <Link
          href={browseDirectoryPath(profile.challenge_id)}
          className="group border-2 border-rule-strong bg-paper p-5 hover:bg-paper-shade sm:p-6"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{t("me.complete_alternative")}</p>
          <h2 className="mt-3 font-listing text-2xl font-bold uppercase tracking-tight">
            {t("me.complete_directory_title")}
          </h2>
          <p className="mt-2 leading-relaxed">{t("me.complete_directory_body")}</p>
          <p className="mt-5 text-sm font-semibold uppercase tracking-wide underline underline-offset-2">
            {t("me.complete_directory_cta")} →
          </p>
        </Link>
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        {t("me.complete_edit_prefix")}{" "}
        <Link href="/me" className="font-semibold text-ink underline underline-offset-2">
          {t("me.complete_edit_cta")}
        </Link>
      </p>
    </section>
  )
}
