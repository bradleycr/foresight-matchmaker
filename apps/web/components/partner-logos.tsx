/**
 * Operator mark for the colophon. Foresight runs this platform;
 * programme hosts are not co-branded here.
 */
export function PartnerLogos({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}
      aria-label="Operated by"
    >
      <li>
        <a
          href="https://foresight.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex opacity-80 transition-opacity hover:opacity-100"
        >
          {/* Official black wordmark — foresight.org/wp-content/uploads/2025/05/logo.png */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/partners/foresight.png"
            alt="Foresight Institute"
            className="h-7 w-auto sm:h-8"
            width={140}
            height={32}
          />
        </a>
      </li>
    </ul>
  )
}
