import { cn } from "@/lib/utils"

/**
 * Nanowheel — Foresight’s nanotube mark, shared with Foresight Map Atlas.
 *
 * Used as the small brand glyph: profile placeholders, nav pending, signed-in
 * chips. The asset is the official RGB icon (black on transparent), square-
 * padded so `object-contain` centres cleanly at every size.
 *
 * Prefer this component over raw `<img>` so spin, sizing, and a11y stay one
 * place. Decorative by default (`aria-hidden`); pass `label` when the mark
 * itself carries meaning.
 */

export const NANOWHEEL_SRC = "/brand/nanowheel.png"

export type NanowheelSize = "xs" | "sm" | "md" | "lg" | "xl"

const SIZE_PX: Record<NanowheelSize, number> = {
  xs: 14,
  sm: 20,
  md: 36,
  lg: 56,
  xl: 88,
}

const SIZE_CLASS: Record<NanowheelSize, string> = {
  xs: "size-3.5",
  sm: "size-5",
  md: "size-9",
  lg: "size-14",
  xl: "size-[5.5rem]",
}

type NanowheelProps = {
  size?: NanowheelSize
  /** Slow axial spin — nav pending, loaders. Honours reduced-motion. */
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
 * Profile glyph: initials over a faint nanowheel.
 * Matches Atlas’s PersonAvatar fallback — branded when there is no photo.
 */
export function ProfileAvatar({
  name,
  size = "md",
  className,
  textClassName,
}: {
  name: string
  size?: NanowheelSize
  className?: string
  textClassName?: string
}) {
  const initials = initialsOf(name)
  const textSize =
    size === "xs" || size === "sm"
      ? "text-[9px] tracking-wide"
      : size === "md"
        ? "text-xs tracking-wide"
        : size === "lg"
          ? "text-sm tracking-wider"
          : "text-base tracking-wider"

  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-rule-strong bg-paper-shade",
        SIZE_CLASS[size],
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={NANOWHEEL_SRC}
        alt=""
        className="pointer-events-none absolute inset-[10%] size-auto max-h-[80%] max-w-[80%] object-contain opacity-[0.28]"
        decoding="async"
        draggable={false}
      />
      <span
        className={cn(
          "relative z-10 font-semibold uppercase text-ink",
          textSize,
          textClassName,
        )}
      >
        {initials}
      </span>
    </span>
  )
}

function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
  if (parts.length === 0) return "·"
  return parts.slice(0, 2).join("").toUpperCase()
}
