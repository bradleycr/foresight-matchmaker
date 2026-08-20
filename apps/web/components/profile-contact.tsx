import type { T } from "@/lib/i18n"

/**
 * Direct contact on a listing: a mailto link, and LinkedIn when they added one.
 * No intro request, no 500-character form — just write to them.
 */
export function ProfileContact({
  orgName,
  email,
  linkedin,
  open,
  t,
}: {
  orgName: string
  email?: string
  linkedin?: string
  open: boolean
  t: T
}) {
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
          >
            {t("contact.email_button")}
          </a>
          <p className="mt-1 text-sm">
            <a href={`mailto:${email}?subject=${subject}`} className="underline underline-offset-2">
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
          >
            {t("contact.linkedin_button")}
          </a>
        </li>
      ) : null}
    </ul>
  )
}
