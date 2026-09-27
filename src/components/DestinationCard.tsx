import Link from "next/link";
import type { DestinationSuggestion, Locale, TravelerCounts } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { serializeChildrenAges } from "@/lib/searchParamsUtil";
import { findCountry } from "@/lib/countries";
import { monthName } from "@/lib/seasons";
import { countLabel } from "@/lib/format";
import Photo from "@/components/Photo";
import VisaBadge from "@/components/VisaBadge";

/** The stay's last night, when discover priced it in nights rather than dates. */
function addDaysIso(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * One answer to "where can my flight budget take me?".
 *
 * A fare alone does not decide a trip, so the card carries the three other
 * things a traveller from the Gulf asks before booking — is it a good time
 * to go, do I need a visa, what will I see — each from data the site holds
 * and has checked, and left out when we don't know it. Then the two ways on:
 * book this flight, or find a hotel in the same city for the same dates.
 *
 * Flights and hotels are separate searches now, so the only budget here is
 * the flight budget; nothing is subtracted for a hotel we have not priced.
 */
export default function DestinationCard({
  suggestion,
  locale,
  origin,
  departDate,
  returnDate,
  travelers,
  currency,
  directOnly,
  baggageIncluded = false,
  photo,
}: {
  suggestion: DestinationSuggestion;
  locale: Locale;
  origin: string;
  departDate: string;
  returnDate: string;
  travelers: TravelerCounts;
  currency: string;
  directOnly: boolean;
  baggageIncluded?: boolean;
  photo?: string;
}) {
  const dict = getDictionary(locale);
  const d = dict.discoverResults;
  const isAr = locale === "ar";
  const name = isAr ? suggestion.destinationNameAr : suggestion.destinationNameEn;
  const place = suggestion.place;
  const country = place ? findCountry(place.countryCode) : undefined;
  const countryName = country ? (isAr ? country.nameAr : country.nameEn) : "";
  const month = Number(departDate.slice(5, 7));
  const monthLabel = month >= 1 && month <= 12 ? monthName(month, locale) : "";
  const fmt = (n: number) => `${Math.abs(n).toLocaleString("en-US")} ${suggestion.currency}`;
  const paying = Math.max(1, travelers.adults + travelers.childrenAges.length);
  const flight = suggestion.flight;

  // The link describes the same trip the card priced: the IATA code the
  // fare was searched on, and the same dates and filters.
  const stayEnd = returnDate || addDaysIso(departDate, suggestion.nights);
  const party = {
    adults: String(travelers.adults),
    childrenAges: serializeChildrenAges(travelers.childrenAges),
    infants: String(travelers.infants),
  };
  const flightParams = new URLSearchParams({
    tripType: "flight",
    origin,
    destination: suggestion.destinationCode,
    departDate,
    returnDate,
    ...party,
    budget: String(suggestion.totalPrice + suggestion.remainingBudget),
    currency,
    directOnly: String(directOnly),
    baggageIncluded: String(baggageIncluded),
  });
  // The hotel search opens on the homepage with the city and dates filled
  // in; the traveller adds a hotel budget and extras there.
  const hotelParams = new URLSearchParams({
    product: "hotels",
    hmode: "discover",
    city: place?.cityNameEn ?? suggestion.destinationNameEn,
    checkIn: departDate,
    checkOut: stayEnd,
    ...party,
  });

  const visaLabels = {
    free: dict.visa.statusFree,
    arrival: dict.visa.statusArrival,
    eta: dict.visa.statusEta,
    required: dict.visa.statusRequired,
  };

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition duration-200 hover:-translate-y-1 hover:shadow-xl ${
        suggestion.withinBudget ? "ring-navy-950/10" : "ring-rose-200"
      }`}
    >
      {/* The place: its photograph, its name, and whether it is a good time. */}
      <div className="relative h-40">
        <Photo
          src={photo}
          className="absolute inset-0 h-full w-full object-cover"
          fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-700 to-navy-990 text-5xl">
              {suggestion.emoji}
            </div>
          }
        />
        <div className="scrim-soft absolute inset-0" />
        {place?.inSeason !== undefined && monthLabel && (
          <span
            className={`absolute start-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${
              place.inSeason ? "bg-emerald-100 text-emerald-900" : "bg-white/90 text-navy-700"
            }`}
          >
            {place.inSeason ? "☀️ " : ""}
            {(place.inSeason ? d.inSeason : d.notInSeason).replace("{month}", monthLabel)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-display text-xl font-black text-white drop-shadow">{name}</p>
          {countryName && <p className="text-sm font-semibold text-white/80">{countryName}</p>}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* The fare: the whole party's total, and what that is per seat. */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-black text-navy-950">{fmt(suggestion.totalPrice)}</p>
            <p className="text-xs text-navy-500">
              {d.totalFor.replace("{count}", String(paying))}
              {flight?.pricePerPerson && paying > 1 && (
                <> · {d.perPersonShort.replace("{price}", fmt(flight.pricePerPerson))}</>
              )}
            </p>
          </div>
          {!suggestion.withinBudget && (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
              {d.overBudgetBy.replace("{amount}", fmt(suggestion.remainingBudget))}
            </span>
          )}
        </div>

        {flight && (
          <div className="mt-2 text-sm text-navy-700">
            <p>
              ✈️ {flight.airline}
              {(!flight.priceOnly || flight.stopsKnown) &&
                ` · ${flight.stops === 0 ? dict.results.stopsNone : `${flight.stops} ${dict.results.stops}`}`}
            </p>
            {flight.priceOnly && (
              <p className="text-xs text-navy-400">
                {flight.datesApproximate ? dict.results.approxDatesNote : dict.results.priceObserved}
              </p>
            )}
          </div>
        )}

        {/* Weather that month and the visa, side by side. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {place?.high !== undefined && (
            <span className="rounded-full bg-mist-50 px-2.5 py-1 text-xs font-bold text-navy-800 ring-1 ring-mist-200">
              {dict.home.seasonHigh.replace("{high}", String(Math.round(place.high)))}
            </span>
          )}
          {place?.rainyDays !== undefined && (
            <span className="rounded-full bg-mist-50 px-2.5 py-1 text-xs font-bold text-navy-800 ring-1 ring-mist-200">
              {Math.round(place.rainyDays) === 0
                ? dict.home.seasonRainNone
                : countLabel(Math.round(place.rainyDays), {
                    one: dict.home.seasonRainOne,
                    two: dict.home.seasonRainTwo,
                    few: dict.home.seasonRainFew,
                    many: dict.home.seasonRainMany,
                  })}
            </span>
          )}
          {place?.visa && <VisaBadge category={place.visa} label={visaLabels[place.visa]} className="!px-2.5 !py-1" />}
        </div>

        {suggestion.withinBudget && (
          <div className="mt-3 flex items-center justify-between border-t border-mist-100 pt-3 text-sm">
            <span className="text-navy-500">{d.remainingFlight}</span>
            <span className="font-bold text-emerald-700">{fmt(suggestion.remainingBudget)}</span>
          </div>
        )}

        <div className="mt-auto space-y-2 pt-4">
          <Link
            href={`/${locale}/results?${flightParams.toString()}`}
            className="block w-full rounded-xl bg-sun-400 px-4 py-3 text-center text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
          >
            ✈️ {d.bookFlight}
          </Link>
          <a
            href={`/${locale}?${hotelParams.toString()}#plan`}
            className="block w-full rounded-xl bg-navy-900 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-navy-800"
          >
            🏨 {d.hotelIn.replace("{city}", name)}
          </a>
          {place && (
            <Link
              href={`/${locale}/attractions/${place.countryCode}/${place.citySlug}`}
              className="block text-center text-xs font-bold text-sea-700 hover:underline"
            >
              {d.aboutCity.replace("{city}", name)}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
