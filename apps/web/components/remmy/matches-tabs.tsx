"use client"

import { useState, type ReactNode } from "react"
import { useT } from "@/lib/i18n/client"

/**
 * Ranked list first. Remmy chat is paused — the tab explains it will
 * return shortly, instead of mounting a client that can take the page down.
 */
export function MatchesTabs({ list }: { list: ReactNode }) {
  const t = useT()
  const [tab, setTab] = useState<"list" | "remmy">("list")

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("matches.tabs_label")}
        className="flex gap-px border-b-2 border-rule-strong"
      >
        <TabButton active={tab === "list"} onClick={() => setTab("list")}>
          {t("matches.tab_list")}
        </TabButton>
        <TabButton active={tab === "remmy"} onClick={() => setTab("remmy")}>
          {t("matches.tab_remmy")}
        </TabButton>
      </div>

      <div role="tabpanel" hidden={tab !== "list"} className={tab === "list" ? "mt-6" : undefined}>
        {list}
      </div>

      <div role="tabpanel" hidden={tab !== "remmy"} className={tab === "remmy" ? "mt-6" : "hidden"}>
        <div className="max-w-xl border border-ink p-4">
          <p className="font-listing text-lg font-bold uppercase">{t("matches.remmy_soon_title")}</p>
          <p className="mt-2 leading-relaxed text-ink-soft">{t("matches.remmy_soon_body")}</p>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "min-h-11 border border-b-0 border-rule-strong bg-mark px-4 py-2 text-sm font-semibold uppercase tracking-wide text-mark-ink"
          : "min-h-11 border border-b-0 border-transparent px-4 py-2 text-sm font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
      }
    >
      {children}
    </button>
  )
}
