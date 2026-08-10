import { cn } from "@/lib/utils"

/**
 * The complete primitive set, hand-built for the directory aesthetic:
 * square corners, 1px ink borders, no shadows, no decorative colour.
 * Buttons say what happens; the mark colour appears only on the primary
 * action and active states.
 */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger"
}

export function Button({ variant = "outline", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 border px-4 py-2 text-sm font-semibold uppercase tracking-wide",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "border-ink bg-mark text-mark-ink hover:bg-ink hover:text-paper",
        variant === "outline" && "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
        variant === "ghost" && "border-transparent text-ink underline underline-offset-4 hover:no-underline",
        variant === "danger" && "border-alert text-alert hover:bg-alert hover:text-paper",
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full border border-ink bg-paper px-3 py-2 text-base text-ink placeholder:text-ink-faint",
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full border border-ink bg-paper px-3 py-2 text-base text-ink placeholder:text-ink-faint",
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("min-h-11 w-full border border-ink bg-paper px-3 py-2 text-base text-ink", className)}
      {...props}
    >
      {children}
    </select>
  )
}

/** Filter chip / multi-select toggle. Active state = the mark colour. */
export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "chip-transition inline-flex min-h-9 items-center border px-3 py-1 text-sm",
        active
          ? "border-ink bg-mark font-semibold text-mark-ink"
          : "border-rule bg-transparent text-ink-soft hover:border-ink hover:text-ink",
        className,
      )}
      {...props}
    />
  )
}

/** Form field wrapper: label, control, optional hint — always stacked. */
export function Field({
  label,
  hint,
  htmlFor,
  required,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold uppercase tracking-wide text-ink">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-sm text-ink-soft">{hint}</p> : null}
    </div>
  )
}

/** Small inline tag — kind markers, states. Ink only, never coloured. */
export function Tag({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-ink px-1.5 py-0.5 font-listing text-xs uppercase tracking-wider",
        className,
      )}
      {...props}
    />
  )
}
