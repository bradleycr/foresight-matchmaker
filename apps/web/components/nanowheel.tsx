import { cn } from "@/lib/utils"

/**
 * Nanowheel — Foresight’s nanotube mark (shared with Map Atlas).
 *
 * Only for Foresight chrome: active nav, footer. Never beside a partner org
 * name — that reads as “this org is Foresight.”
 */

export const NANOWHEEL_SRC = "/brand/nanowheel.png"

export type NanowheelSize = "xs" | "sm" | "md" | "lg"

const SIZE_PX: Record<NanowheelSize, number> = {
  xs: 14,
  sm: 20,
  md: 36,
  lg: 52,
}

const SIZE_CLASS: Record<NanowheelSize, string> = {
  xs: "size-3.5",
  sm: "size-5",
  md: "size-9",
  lg: "size-[3.25rem]",
}

type NanowheelProps = {
  size?: NanowheelSize
  spin?: boolean
  className?: string
  label?: string
}

export function Nanowheel({ size = "md", spin = false, className, label }: NanowheelProps) {
  const px = SIZE_PX[size]
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand glyph
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
