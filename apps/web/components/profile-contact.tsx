"use client"

import { useT } from "@/lib/i18n/client"

/**
 * Direct contact on a listing: a mailto link, and LinkedIn when they added one.
 * Opening either is an introduction — logged so admin can see whether people
 * actually reached out. This site never sends the message.
 */

function recordClick(toProfileId: string | undefined, channel: "email" | "linkedin") {
  if (!toProfileId) return
  const body = JSON.stringify({ to_id: toProfileId, channel })

  // Beacon first: mailto hands the page to the mail client before fetch can
  // settle. Same-origin cookies still go. The server dedupes actor+target+
  // channel, so a later fetch from onClick is harmless.
  const blob = new Blob([body], { type: "application/json" })
  const queued =
    typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
      ? navigator.sendBeacon("/api/v1/contact-events", blob)
      : false
  if (queued) return

  void fetch("/api/v1/contact-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "include",
  })
}

/** Pointer-down fires before mailto navigation; click covers keyboard activation. */
function track(toProfileId: string | undefined, channel: "email" | "linkedin") {
  const fire = () => recordClick(toProfileId, channel)
  return { onPointerDown: fire, onClick: fire }
}

export function ProfileContact({
  orgName,
  email,
  linkedin,
  open,
  toProfileId,
}: {
  orgName: string
  email?: string
  linkedin?: string
  open: boolean
  toProfileId?: string
}) {
  const t = useT()

  if (!open) {
    return <p className="mt-2 text-ink-soft">{t("contact.not_open")}</p>
  }

  if (!email && !linkedin) {
    return <p className="mt-2 text-ink-soft">{t("contact.none")}</p>
  }

  const subject = encodeURIComponent(t("contact.mail_subject", { name: orgName }))

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {email ? (
        <li>
          <a
            href={`mailto:${email}?subject=${subject}`}
            className="inline-flex min-h-11 items-center border border-ink bg-mark px-4 text-sm font-semibold uppercase tracking-wide text-mark-ink hover:bg-ink hover:text-paper"
            {...track(toProfileId, "email")}
          >
            {t("contact.email_button")}
          </a>
          <p className="mt-1 text-sm">
            <a
              href={`mailto:${email}?subject=${subject}`}
              className="underline underline-offset-2"
              {...track(toProfileId, "email")}
            >
              {email}
            </a>
          </p>
        </li>
      ) : null}
      {linkedin ? (
        <li>
          <a
            href={linkedin}
            className="inline-flex min-h-11 items-center border border-ink px-4 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-paper"
            rel="noopener noreferrer"
            target="_blank"
            {...track(toProfileId, "linkedin")}
          >
            {t("contact.linkedin_button")}
          </a>
        </li>
      ) : null}
    </ul>
  )
}
