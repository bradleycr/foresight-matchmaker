"use client"

import { useState } from "react"
import Link from "next/link"
import type { IntroPayload } from "@/lib/api/types"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Button, Tag } from "@/components/ui/primitives"

/**
 * Contacts log — who you emailed, and who emailed you. The thread itself
 * lives in ordinary email; this is the on-platform record.
 */

function ContactBlock({ intro, t }: { intro: IntroPayload; t: ReturnType<typeof useT> }) {
  const c = intro.counterpart
  if (!c?.contact_email) return null
  return (
    <div className="mt-2 border border-ink bg-paper-shade p-3 text-sm">
      <p className="font-semibold uppercase tracking-wide">{t("inbox.contact_revealed")}</p>
      <p className="mt-1">
        {c.contact_name}
        {c.contact_role ? ` — ${c.contact_role}` : ""}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2">
        <a href={`mailto:${c.contact_email}?subject=${encodeURIComponent(`${c.org_name} / Foresight Matchmaking`)}`} className="underline">
          {c.contact_email}
        </a>
        <CopyEmail email={c.contact_email} />
      </p>
    </div>
  )
}

function IntroRow({ intro }: { intro: IntroPayload }) {
  const t = useT()

  return (
    <li className="border-b border-rule py-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Tag>{t(`inbox.direction_${intro.direction}`)}</Tag>
        <Tag>{enumLabel(t, "intro_state", intro.state)}</Tag>
        {intro.counterpart ? (
          <Link href={`/profile/${intro.counterpart.slug}`} className="font-listing text-lg font-bold uppercase hover:underline">
            {intro.counterpart.org_name}
          </Link>
        ) : (
          <span className="text-ink-soft">{t("inbox.profile_gone")}</span>
        )}
        <span className="tnum text-sm text-ink-soft">{intro.created_at.slice(0, 10)}</span>
      </div>

      <blockquote className="mt-2 border-l-2 border-rule pl-3 text-sm">{intro.message}</blockquote>
      <ContactBlock intro={intro} t={t} />
    </li>
  )
}

function CopyEmail({ email }: { email: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      className="min-h-9 px-3 py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          /* clipboard may be denied; mailto remains */
        }
      }}
    >
      {copied ? t("inbox.copied") : t("inbox.copy_email")}
    </Button>
  )
}

export function InboxList({ intros }: { intros: IntroPayload[] }) {
  const t = useT()

  if (intros.length === 0) {
    return <p className="mt-8 max-w-xl border border-ink p-4">{t("inbox.empty")}</p>
  }

  return <ul className="mt-6">{intros.map((intro) => <IntroRow key={intro.id} intro={intro} />)}</ul>
}
