/** Right rail of the HDMI board — always on the same frame as the room. */
export function LiveFeedQrRail({
  qrSvg,
  joinUrl,
  scanLabel,
  scanHint,
}: {
  qrSvg: string
  joinUrl: string
  scanLabel: string
  scanHint: string
}) {
  const hostPath = joinUrl.replace(/^https:\/\//, "")

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col justify-between border-l-2 border-ink bg-paper-shade px-6 py-6">
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div
          className="aspect-square w-full border-2 border-ink bg-paper p-4 text-ink"
          role="img"
          aria-label={scanLabel}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-6 font-listing text-4xl uppercase leading-none tracking-tight">{scanLabel}</p>
        <p className="mt-3 text-sm leading-snug text-ink-soft">{scanHint}</p>
      </div>
      <p className="mt-6 break-all text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{hostPath}</p>
    </aside>
  )
}
