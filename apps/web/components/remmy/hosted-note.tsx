"use client"

import Link from "next/link"
import { useT } from "@/lib/i18n/client"
import { cn } from "@/lib/utils"

/**
 * One-line fact for every Remmy entry point: inference stays on
 * Foresight hardware in Berlin, not a consumer US cloud.
 */
export function RemmyHostedNote({
  className,
  withPrivacyLink = false,
}: {
  className?: string
  withPrivacyLink?: boolean
}) {
  const t = useT()
  return (
    <p className={cn("text-sm leading-relaxed", className)}>
      {t("remmy.hosted_note")}
      {withPrivacyLink ? (
        <>
          {" "}
          <Link href="/privacy" className="font-semibold underline underline-offset-2">
            {t("remmy.hosted_privacy")}
          </Link>
        </>
      ) : null}
    </p>
  )
}
