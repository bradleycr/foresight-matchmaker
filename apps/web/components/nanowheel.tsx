import { cn } from "@/lib/utils"

/**
 * Nanowheel — Foresight’s nanotube mark, shared with Foresight Map Atlas.
 *
 * The mark itself is the glyph. No letter overlays, no framed chip — those
 * fought the icon at small sizes. Profile spots use the same clean mark.
 */

export const NANOWHEEL_SRC = "/brand/nanowheel.png"

export type NanowheelSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero"

const SIZE_PX: Record<NanowheelSize, number> = {
  xs: 16,
  sm: 22,
  md: 36,
  lg: 52,
  xl: 72,
  hero: 64,
}

const SIZE_CLASS: Record<NanowheelSize, string> = {
  xs: "size-4",
  sm: "size-[1.375rem]",
  md: "size-9",
  lg: "size-[3.25rem]",
  xl: "size-[4.5rem]",
  hero: "size-14 sm:size-16",
}

type NanowheelProps = {
  size?: NanowheelSize
  /** Slow axial spin — nav pending only. Honours reduced-motion. */
  spin?: boolean
  className?: string
  /** When set, exposed to assistive tech; otherwise decorative. */
  label?: string
}

export function Nanowheel({ size = "md", spin = false, className, label }: NanowheelProps) {
  const px = SIZE_PX[size]
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand glyph; CSS size tokens, not layout photos
    <img
      src={NANOWHEEL_SRC}
      alt={label ?? ""}
      width={px}
      height={px}
      decoding="async"
      draggable={false}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-block shrink-0 object-contain select-none",
        SIZE_CLASS[size],
        spin && "nanowheel-spin",
        className,
      )}
    />
  )
}

/**
 * Profile stand-in: the nanowheel alone on paper wash — no border frame,
 * no initials. Reads as Foresight at a glance next to a name.
 */
export function ProfileAvatar({
  name,
  size = "md",
  className,
}: {
  /** Kept for callers / future photo URLs; unused while we show the mark. */
  name: string
  size?: NanowheelSize
  className?: string
}) {
  void name
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center", SIZE_CLASS[size], className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={NANOWHEEL_SRC}
        alt=""
        className="size-full object-contain opacity-90"
        decoding="async"
        draggable={false}
      />
    </span>
  )
}
