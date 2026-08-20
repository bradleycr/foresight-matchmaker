"use client"

import { useEffect } from "react"
import type { ChallengeTheme } from "@/lib/challenges/themes"

const VARS = [
  "--programme-paper",
  "--programme-paper-shade",
  "--programme-rule",
  "--programme-accent",
] as const

/**
 * Applies a programme palette to the whole page — body background, header,
 * footer, and content share one wash. Clears on leave.
 */
export function ProgrammeTheme({
  programmeId,
  theme,
}: {
  programmeId: string
  theme: ChallengeTheme
}) {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.programme = programmeId
    root.style.setProperty("--programme-paper", theme.paper)
    root.style.setProperty("--programme-paper-shade", theme.paperShade)
    root.style.setProperty("--programme-rule", theme.rule)
    root.style.setProperty("--programme-accent", theme.accent)

    return () => {
      delete root.dataset.programme
      for (const key of VARS) root.style.removeProperty(key)
    }
  }, [programmeId, theme])

  return null
}
