"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useT } from "@/lib/i18n/client"
import { Button } from "@/components/ui/primitives"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export function SignOutButton({
  className,
  variant = "outline",
}: {
  className?: string
  variant?: "primary" | "outline" | "ghost" | "danger"
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => {
    if (!busy) setOpen(false)
  }, [busy])

  async function signOut() {
    if (busy) return
    setBusy(true)
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" })
      router.push("/")
      router.refresh()
    } catch {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setOpen(true)}>
        {t("me.sign_out")}
      </Button>
      <ConfirmDialog
        open={open}
        title={t("me.sign_out_title")}
        body={t("me.sign_out_body")}
        confirmLabel={busy ? t("me.sign_out_working") : t("me.sign_out")}
        cancelLabel={t("me.sign_out_cancel")}
        busy={busy}
        onConfirm={signOut}
        onCancel={close}
      />
    </>
  )
}
