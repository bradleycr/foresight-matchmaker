"use client"

import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"

export function SignOutButton({
  className,
  variant = "outline",
}: {
  className?: string
  variant?: "primary" | "outline" | "ghost" | "danger"
}) {
  const t = useT()
  const router = useRouter()

  return (
    <Button
      variant={variant}
      className={className}
      onClick={async () => {
        await fetch("/api/v1/auth/logout", { method: "POST" })
        router.push("/")
        router.refresh()
      }}
    >
      {t("me.sign_out")}
    </Button>
  )
}
