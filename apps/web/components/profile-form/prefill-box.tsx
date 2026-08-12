"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { EXAMPLE_AI_ABOUT } from "@/lib/llm/example-about"

/**
 * Paste an About page (or any prose) → structured draft on the form.
 * Includes a one-click example for demo rehearsals.
 */
export function PrefillBox({ onProposal }: { onProposal: (p: PrefillProposal) => void }) {
  const t = useT()
  const [text, setText] = useState("")
  const [status, setStatus] = useState<"idle" | "busy" | "applied" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  async function propose(source?: string) {
    const body = (source ?? text).trim()
    if (body.length < 40) return

    setStatus("busy")
    setError(null)
    if (source) setText(source)

    const res = await fetch("/api/v1/prefill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    })

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      setError(payload?.error ?? t("form.prefill_error"))
      setStatus("error")
      return
    }

    const { proposal } = (await res.json()) as { proposal: PrefillProposal }
    onProposal(proposal)
    setStatus("applied")
  }

  return (
    <section className="border border-rule-strong bg-paper-shade p-4">
      <h2 className="font-listing text-lg font-bold uppercase">{t("form.prefill_title")}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t("form.prefill_hint")}</p>
      <Textarea
        aria-label={t("form.prefill_title")}
        rows={6}
        maxLength={8000}
        placeholder={t("form.prefill_placeholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-3 bg-paper"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" disabled={status === "busy" || text.trim().length < 40} onClick={() => void propose()}>
          {status === "busy" ? t("form.prefill_busy") : t("form.prefill_button")}
        </Button>
        <Button
          type="button"
          disabled={status === "busy"}
          onClick={() => void propose(EXAMPLE_AI_ABOUT)}
        >
          {t("form.prefill_example")}
        </Button>
        {status === "applied" && <span className="text-sm font-semibold">{t("form.prefill_applied")}</span>}
        {error && (
          <span role="alert" className="text-sm text-alert">
            {error}
          </span>
        )}
      </div>
    </section>
  )
}
