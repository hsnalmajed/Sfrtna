import type { Locale } from "@/lib/types";
import type { ViatorTour } from "@/lib/viator";

interface TourDict {
  fromPrice: string;
  perPerson: string;
  reviews: string;
  durationHours: string;
  durationDays: string;
  bookNow: string;
}

function formatDuration(minutes: number | undefined, dict: TourDict): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes >= 24 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return dict.durationDays.replace("{d}", String(days));
  }
  const hours = minutes / 60;
  // Keep one decimal only when it actually adds information (1.5h, not 2.0h).
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return dict.durationHours.replace("{h}", label);
}

// Mirrors how a real tour marketplace lists a product: wide photo, title,
// two-line summary, rating with review count, duration, and a clear
// "from <price>" with the booking button. Every value here is whatever
// Viator returned for this exact product — nothing is estimated or filled in.
export default function TourCard({
  tour,
  locale,
  dict,
}: {
  tour: ViatorTour;
  locale: Locale;
  dict: TourDict;
}) {
  const duration = formatDuration(tour.durationMinutes, dict);

  return (
    <article className="flex flex-col sm:flex-row overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-brand-200">
      <div className="relative sm:w-64 shrink-0 h-44 sm:h-auto bg-gray-100">
        {tour.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tour.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-300">🎟️</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-bold text-gray-900 leading-snug" dir="ltr">
          {tour.title}
        </h3>

        {tour.description && (
          <p className="mt-1.5 text-sm text-gray-500 leading-snug line-clamp-2" dir="ltr">
            {tour.description}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {typeof tour.rating === "number" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-semibold text-accent-800">
              <span aria-hidden="true">★</span>
              {tour.rating.toFixed(1)}
              {typeof tour.reviewCount === "number" && (
                <span className="font-normal text-accent-700">
                  ({tour.reviewCount.toLocaleString()} {dict.reviews})
                </span>
              )}
            </span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
              <span aria-hidden="true">⏱️</span> {duration}
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3.5">
          {typeof tour.priceFrom === "number" ? (
            <div>
              <p className="text-[11px] font-semibold text-gray-400">{dict.fromPrice}</p>
              <p className="text-lg font-extrabold text-gray-900" dir="ltr">
                {tour.priceFrom.toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
                  style: "currency",
                  currency: tour.currency,
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-[11px] text-gray-400">{dict.perPerson}</p>
            </div>
          ) : (
            <span />
          )}

          <a
            href={tour.url}
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            data-partner="viator"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-700 to-brand-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
          >
            🎟️ {dict.bookNow}
          </a>
        </div>
      </div>
    </article>
  );
}
