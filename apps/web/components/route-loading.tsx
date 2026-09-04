/**
 * Instant fallback while a dynamic page’s RSC payload is in flight.
 * Kept static (no cookies, no data) so Next can prefetch this shell on
 * header hover — without a loading file, dynamic routes are not prefetched.
 */
export function RouteLoading() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3 py-14">
      <div className="h-2 w-20 bg-ink/25" />
      <div className="h-8 w-2/3 max-w-md bg-ink/15" />
      <div className="mt-4 h-2 w-full max-w-lg bg-rule" />
      <div className="h-2 w-5/6 max-w-md bg-rule" />
      <div className="h-2 w-3/5 max-w-sm bg-rule" />
    </div>
  )
}
