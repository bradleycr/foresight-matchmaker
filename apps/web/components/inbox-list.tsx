"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { DECLINE_REASON, type DeclineReason } from "@rmm/schema"
import type { IntroPayload } from "@/lib/api/types"
import { useT } from "@/lib/i18n/client"
import { enumLabel } from "@/lib/i18n/labels"
import { Button, Select, Tag } from "@/components/ui/primitives"

/**
 * Inbox rows. A received `requested` intro carries the two actions of the
 * double opt-in; everything else is a record. Accepting reveals the
 * counterpart's contact block, returned by the server on acceptance.
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
      <p>
        <a href={`mailto:${c.contact_email}`} className="underline">
          {c.contact_email}
        </a>
      </p>
    </div>
  )
}

function IntroRow({ intro }: { intro: IntroPayload }) {
  const t = useT()
  const router = useRouter()
  const [reason, setReason] = useState<DeclineReason>("other")
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")

  async function respond(action: "accepted" | "declined") {
    setWorking(true)
    setError("")
    const res = await fetch(`/api/v1/intros/${intro.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(action === "declined" ? { decline_reason: reason } : {}) }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(body.error ?? t("intro.error_generic"))
      setWorking(false)
    }
  }

  const isOpenReceived = intro.direction === "received" && intro.state === "requested"

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
        {intro.state === "requested" && (
          <span className="tnum text-sm text-ink-soft">
            {t("inbox.expires", { date: intro.expires_at.slice(0, 10) })}
          </span>
        )}
        {intro.state === "expired" && (
          <span className="tnum text-sm text-ink-soft">
            {t("inbox.expired_on", { date: intro.expires_at.slice(0, 10) })}
          </span>
        )}
      </div>

      <blockquote className="mt-2 border-l-2 border-rule pl-3 text-sm">{intro.message}</blockquote>

      {intro.state === "declined" && intro.decline_reason && (
        <p className="mt-1 text-sm text-ink-soft">
          {t("inbox.decline_reason")}: {enumLabel(t, "decline_reason", intro.decline_reason)}
        </p>
      )}

      <ContactBlock intro={intro} t={t} />

      {isOpenReceived && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Button variant="primary" disabled={working} onClick={() => respond("accepted")}>
            {t("inbox.accept")}
          </Button>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide">
              {t("inbox.decline_reason")}
              <Select value={reason} onChange={(e) => setReason(e.target.value as DeclineReason)} className="min-h-11">
                {DECLINE_REASON.map((r) => (
                  <option key={r} value={r}>
                    {enumLabel(t, "decline_reason", r)}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="danger" disabled={working} onClick={() => respond("declined")}>
              {t("inbox.decline")}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 border border-alert px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}
    </li>
  )
}

export function InboxList({ intros }: { intros: IntroPayload[] }) {
  const t = useT()

  if (intros.length === 0) {
    return <p className="mt-8 max-w-xl border border-ink p-4">{t("inbox.empty")}</p>
  }

  return <ul className="mt-6">{intros.map((intro) => <IntroRow key={intro.id} intro={intro} />)}</ul>
}
