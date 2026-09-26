import Link from "next/link";
import type { RoomType, DestinationSuggestion, Locale, TravelerCounts, TripType } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { formatDuration } from "@/lib/format";
import { serializeChildrenAges } from "@/lib/searchParamsUtil";

/** The stay's last night, when discover priced it in nights rather than dates. */
function addDaysIso(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DestinationCard({
  suggestion,
  locale,
  origin,
  tripType,
  departDate,
  returnDate,
  travelers,
  currency,
  directOnly,
  minStars,
  roomType,
  baggageIncluded = false,
  breakfastIncluded = false,
}: {
  suggestion: DestinationSuggestion;
  locale: Locale;
  origin: string;
  tripType: TripType;
  departDate: string;
  returnDate: string;
  travelers: TravelerCounts;
  currency: string;
  directOnly: boolean;
  minStars: number;
  roomType?: RoomType;
  baggageIncluded?: boolean;
  breakfastIncluded?: boolean;
}) {
  const dict = getDictionary(locale);
  const name = locale === "ar" ? suggestion.destinationNameAr : suggestion.destinationNameEn;

  /**
   * The link has to describe the *same trip* the card just priced.
   *
   * It did not, and this is why a card offering Cairo for 4,545 riyals opened
   * a page offering 3,610 with a different hotel and a different stopover.
   * Two things were wrong:
   *
   *  - It sent `destination: name` — the localised city name, "طوكيو". The
   *    search that produced this card ran on the IATA code, "TYO". Every
   *    price on the site is derived from a seed built out of that string, so
   *    a different string is a different trip: different airline, different
   *    hotel, different price. Sending the code makes the two agree.
   *  - It dropped the trip length. Discover works in nights and computes the
   *    return date itself; the card forwarded an empty `returnDate`, and the
   *    results page reads a missing return date as a one-night stay. A
   *    five-night hotel total silently became one night.
   *
   * The remaining filters travel too, for the same reason: a filter the
   * suggestion was priced under but the results page never sees is a filter
   * that changes the answer.
   */
  const stayEnd = returnDate || addDaysIso(departDate, suggestion.nights);

  const resultsParams = new URLSearchParams({
    tripType,
    origin,
    destination: suggestion.destinationCode,
    departDate,
    returnDate: stayEnd,
    adults: String(travelers.adults),
    childrenAges: serializeChildrenAges(travelers.childrenAges),
    infants: String(travelers.infants),
    budget: String(suggestion.totalPrice + suggestion.remainingBudget),
    currency,
    directOnly: String(directOnly),
    minStars: String(minStars),
    roomType: roomType || "",
    baggageIncluded: String(baggageIncluded),
    breakfastIncluded: String(breakfastIncluded),
  });

  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
        suggestion.withinBudget ? "ring-brand-100 hover:ring-brand-300" : "ring-red-100 hover:ring-red-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{suggestion.emoji}</span>
          <span className="font-bold text-gray-900">{name}</span>
        </div>
        <span className="text-lg font-extrabold text-gray-900">
          {suggestion.totalPrice.toLocaleString()} {suggestion.currency}
        </span>
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        {suggestion.flight && (
          <>
            {/* Stops and baggage only when the source said so. The fare
                feed gives a price and an airline, not the routing: printing
                "direct" or "no checked bag" for it would be inventing facts
                a traveller books on. */}
            <p>
              ✈️ {suggestion.flight.airline}
              {(!suggestion.flight.priceOnly || suggestion.flight.stopsKnown) &&
                ` · ${suggestion.flight.stops === 0 ? dict.results.stopsNone : `${suggestion.flight.stops} ${dict.results.stops}`}`}
            </p>
            {suggestion.flight.priceOnly && (
              <p className="text-xs text-gray-400 ps-5">{dict.results.priceObserved}</p>
            )}
            {suggestion.flight.stops > 0 && suggestion.flight.layoverCity && (
              <p className="text-xs text-gray-400 ps-5">
                {dict.results.layoverIn
                  .replace("{city}", suggestion.flight.layoverCity)
                  .replace(
                    "{duration}",
                    suggestion.flight.layoverDurationMinutes
                      ? formatDuration(suggestion.flight.layoverDurationMinutes, locale)
                      : ""
                  )}
              </p>
            )}
          </>
        )}
        {!suggestion.hotel && tripType !== "flight" && (
          // No hotel price, and no pretending there is one. What a budget
          // traveller actually needs at this moment is the subtraction: the
          // flight costs this much, so this much is left for the room. The
          // real room prices are one click away, on the results page.
          <p>
            🏨{" "}
            {suggestion.remainingBudget > 0
              ? dict.results.hotelBudgetLeft
                  .replace("{amount}", suggestion.remainingBudget.toLocaleString())
                  .replace("{currency}", suggestion.currency)
              : dict.results.hotelBudgetGone}
          </p>
        )}
        {suggestion.hotel && (
          <>
            <p>
              🏨 {suggestion.hotel.name} · {"★".repeat(Math.max(1, suggestion.hotel.stars))} · {suggestion.nights} {dict.results.nights}
            </p>
            {!suggestion.hotel.priceOnly && (
              <p className="text-xs text-gray-400 ps-5">
                {dict.results.distanceFromCenter.replace("{km}", String(suggestion.hotel.distanceFromCenterKm))}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestion.flight && !suggestion.flight.priceOnly && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              suggestion.flight.baggageIncluded ? "bg-accent-50 text-accent-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            🧳 {suggestion.flight.baggageIncluded ? dict.results.baggageYes : dict.results.baggageNo}
          </span>
        )}
        {suggestion.hotel && !suggestion.hotel.priceOnly && (
          <>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                suggestion.hotel.breakfastIncluded ? "bg-accent-50 text-accent-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              🍳 {suggestion.hotel.breakfastIncluded ? dict.results.breakfastYes : dict.results.breakfastNo}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              🛏️ {dict.roomType[suggestion.hotel.roomType]}
            </span>
          </>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
        <span className="text-gray-500">{dict.results.remainingBudget}</span>
        <span className={suggestion.remainingBudget >= 0 ? "text-brand-900 font-semibold" : "text-red-600 font-semibold"}>
          {suggestion.remainingBudget.toLocaleString()} {suggestion.currency}
        </span>
      </div>

      <Link
        href={`/${locale}/results?${resultsParams.toString()}`}
        className="mt-4 block w-full text-center rounded-xl bg-gradient-to-r from-brand-700 to-brand-900 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
      >
        {dict.discoverResults.viewDetails}
      </Link>
    </div>
  );
}
