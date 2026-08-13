import { ForesightMark } from "./foresight-mark"

/**
 * Operator mark in the colophon. Programme hosts are not co-branded here.
 */
export function PartnerLogos({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-label="Operated by">
      <a
        href="https://foresight.org/"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex"
      >
        <ForesightMark className="h-6 sm:h-7" />
      </a>
    </div>
  )
}
