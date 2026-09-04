import { notFound } from "next/navigation"
import { ProgrammeTheme } from "@/components/programme-theme"
import { challengeBySlug } from "@/lib/challenges/catalog"
import { isChallengeVisible } from "@/lib/challenges/visibility"
import { challengeTheme } from "@/lib/challenges/themes"

/** Programme pages tint the full viewport — not a boxed section in main. */
export default async function ChallengeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const challenge = challengeBySlug(slug)
  if (!challenge || !isChallengeVisible(challenge.id)) notFound()

  const theme = challengeTheme(challenge.id)

  return (
    <>
      <ProgrammeTheme programmeId={challenge.id} theme={theme} />
      {children}
    </>
  )
}
