"use client"

import { useState, type ReactNode } from "react"
import { useT } from "@/lib/i18n/client"
import { RemmyGuideChat } from "./guide-chat"

/**
 * Matches hub tabs: ranked list first, Remmy chat as the optional surface.
 * Remmy stays mounted (hidden) so a draft conversation survives a tab flip.
 */
export function MatchesTabs({
  list,
  remmyEnabled,
}: {
  list: ReactNode
  remmyEnabled: boolean
}) {
  const t = useT()
  const [tab, setTab] = useState<"list" | "remmy">("list")

  if (!remmyEnabled) return <>{list}</>

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
        <p className="mb-4 max-w-2xl text-sm text-ink-soft">{t("guide.page_explainer")}</p>
        <RemmyGuideChat embedded />
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
