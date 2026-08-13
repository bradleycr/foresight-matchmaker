import { ForesightMark } from "./foresight-mark"

/**
 * Operator imprint in the colophon — same publisher plate as the masthead,
 * quieter scale. Programme hosts are not co-branded here.
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
        <ForesightMark className="px-2.5 py-2 [&_img]:h-6 sm:[&_img]:h-7" />
      </a>
    </div>
  )
}
