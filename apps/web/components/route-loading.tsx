/**
 * Instant fallback while a dynamic page’s RSC payload is in flight.
 * Kept static (no cookies, no data) so Next can prefetch this shell on
 * header hover — without a loading file, dynamic routes are not prefetched.
 *
 * The bars breathe on a stagger. A placeholder that holds still is
 * indistinguishable from a page that has stopped responding, and the honest
 * human answer to a frozen page is to tap the tab again.
 */
export function RouteLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3 py-14">
      <div className="skeleton-line h-2 w-20 bg-ink/25" />
      <div className="skeleton-line h-8 w-2/3 max-w-md bg-ink/15 [animation-delay:120ms]" />
      <div className="skeleton-line mt-4 h-2 w-full max-w-lg bg-rule [animation-delay:240ms]" />
      <div className="skeleton-line h-2 w-5/6 max-w-md bg-rule [animation-delay:360ms]" />
      <div className="skeleton-line h-2 w-3/5 max-w-sm bg-rule [animation-delay:480ms]" />
    </div>
  )
}
