import { notFound } from "next/navigation"
import { challengeBySlug } from "@/lib/challenges/catalog"
import { challengeTheme, challengeThemeStyle } from "@/lib/challenges/themes"

/**
 * Full-bleed programme wash inside the main column. Token overrides cascade
 * to descendants so existing `bg-paper`, `border-teal`, etc. pick up the
 * challenge palette without one-off classes on every block.
 */
export default async function ChallengeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const challenge = challengeBySlug(slug)
  if (!challenge) notFound()

  const theme = challengeTheme(challenge.id)

  return (
    <div
      className="programme-surface -mx-4 flex flex-1 flex-col px-4 pb-4 sm:-mx-6 sm:px-6"
      data-programme={challenge.id}
      style={challengeThemeStyle(theme)}
    >
      <div className="programme-band -mx-4 mb-8 h-1 sm:-mx-6" aria-hidden="true" />
      {children}
    </div>
  )
}
