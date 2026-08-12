/**
 * Quiet partner marks for the masthead / colophon.
 * Sized to read as attribution, not as competing brand chrome.
 */
export function PartnerLogos({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}
      aria-label="Partner organisations"
    >
      <li>
        <a
          href="https://www.sprind.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex opacity-80 transition-opacity hover:opacity-100"
        >
          {/* Official SPRIND wordmark (press kit, RGB black). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/partners/sprind.svg"
            alt="SPRIND — Federal Agency for Breakthrough Innovation"
            className="h-5 w-auto sm:h-6"
            width={148}
            height={22}
          />
        </a>
      </li>
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
