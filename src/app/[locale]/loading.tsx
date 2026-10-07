/**
 * What a page shows the moment a link is tapped, while the server prepares it.
 *
 * Without this file Next keeps the old page on screen until the new one is
 * ready: on a phone, a tap that changes nothing for a second reads as a
 * button that does not work. The header and footer stay (they are the
 * layout); the area between them turns into the shape of a page — a navy
 * band where the title goes, then a few cards — so the tap answers at once.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="min-h-[70vh]">
      <span className="sr-only">…</span>
      {/* A thin moving line under the header: the page is on its way. */}
      <div className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-sun-400/20">
        <div className="sfr-progress h-full w-1/3 bg-sun-400" />
      </div>

      <div className="bg-gradient-to-b from-navy-990 to-navy-900 hero-pad pb-12 pt-28 sm:pt-32">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/15" />
          <div className="mt-4 h-8 w-56 animate-pulse rounded-xl bg-white/20 sm:w-80" />
          <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-full bg-white/10" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-black/5" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-mist-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
