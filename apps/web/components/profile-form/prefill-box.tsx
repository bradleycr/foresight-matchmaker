"use client"

import { useState } from "react"
import { useT } from "@/lib/i18n/client"
import { Button, Textarea } from "@/components/ui/primitives"
import type { PrefillProposal } from "@/lib/llm/prefill"
import { fetchPrefill } from "@/lib/llm/fetch-prefill"
import { summaryFromProposal } from "@/lib/llm/proposal-utils"
import { RemmyDraftReview } from "@/components/remmy/draft-review"

/**
 * Paste an About page → structured draft on the form via the same extractor
 * and human review checkpoint as Remmy chat.
 */
export function PrefillBox({ onProposal }: { onProposal: (p: PrefillProposal) => void }) {
  const t = useT()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ proposal: PrefillProposal; summary: string[] } | null>(null)

  async function propose() {
    const body = text.trim()
    if (body.length < 40) return

    setBusy(true)
    setError(null)

    const result = await fetchPrefill(body, "paste")
    setBusy(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setPending({ proposal: result.proposal, summary: summaryFromProposal(result.proposal) })
  }

  return (
    <section className="border border-rule-strong bg-paper-shade p-4">
      <h2 className="font-listing text-lg font-bold uppercase">{t("form.prefill_title")}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t("form.prefill_hint")}</p>

      {pending ? (
        <div className="mt-4">
          <RemmyDraftReview
            mode="create"
            proposal={pending.proposal}
            summary={pending.summary}
            onConfirm={() => {
              onProposal(pending.proposal)
              setPending(null)
              setText("")
            }}
            onRevise={() => setPending(null)}
            onDiscard={() => {
              setPending(null)
              setText("")
            }}
          />
        </div>
      ) : (
        <>
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
            <Button type="button" variant="primary" disabled={busy || text.trim().length < 40} onClick={() => void propose()}>
              {busy ? t("form.prefill_busy") : t("form.prefill_button")}
            </Button>
            {error && (
              <span role="alert" className="text-sm text-alert">
                {error}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  )
}
