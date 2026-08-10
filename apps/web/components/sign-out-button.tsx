"use client"

import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"

export function SignOutButton() {
  const t = useT()
  const router = useRouter()

  return (
    <Button
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
