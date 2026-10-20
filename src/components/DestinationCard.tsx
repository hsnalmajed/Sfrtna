import Link from "next/link";
import VisaDetailsButton from "@/components/VisaDetailsButton";
import { CLASS_DOT } from "@/lib/travelSeason/labels";
import type { DestinationSuggestion, Locale, TravelerCounts } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { serializeChildrenAges } from "@/lib/searchParamsUtil";
import { findCountry } from "@/lib/countries";
import { monthName } from "@/lib/seasons";
import { countLabel } from "@/lib/format";
import Photo from "@/components/Photo";
import VisaBadge from "@/components/VisaBadge";
import Flag from "@/components/ui/Flag";
import { comboHotelHref, readCombo } from "@/lib/combo";

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
 * No price is printed here. The destination was chosen because the fares
 * seen for it lately fit the budget, but a seen fare is not the price at
 * the booking site, and a site built on budgets shows the live price or
 * none. "See the live price and book" opens the live search for this trip.
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
  hotelFirst = false,
  combo,
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
  /** "Hotel only" search: the hotel search is the card's main button. */
  hotelFirst?: boolean;
  /** «طيران + فندق»: the hotel half's own keys, carried to both buttons. */
  combo?: URLSearchParams;
}) {
  const dict = useDictionary();
  const d = dict.discoverResults;
  const isAr = locale === "ar";
  const name = isAr ? suggestion.destinationNameAr : suggestion.destinationNameEn;
  const place = suggestion.place;
  const country = place ? findCountry(place.countryCode) : undefined;
  const countryName = country ? (isAr ? country.nameAr : country.nameEn) : "";
  const month = Number(departDate.slice(5, 7));
  const monthLabel = month >= 1 && month <= 12 ? monthName(month, locale) : "";

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
    mode: "known",
    tripRoute: returnDate ? "roundtrip" : "oneway",
  });
  if (combo) for (const [k, v] of combo) flightParams.set(k, v);
  // Straight to the city's hotels for these dates and this party (it used
  // to open the home form, one more step for nothing).
  const hotelHref = combo
    ? comboHotelHref(locale, readCombo(combo), { nameEn: place?.cityNameEn ?? suggestion.destinationNameEn, label: name }, departDate, stayEnd, party)
    : `/${locale}/hotel-results?${new URLSearchParams({
        hmode: "discover",
        city: place?.cityNameEn ?? suggestion.destinationNameEn,
        label: name,
        checkIn: departDate,
        checkOut: stayEnd,
        ...party,
      })}`;

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
      {/* Two to a row on a phone: the picture, then the name and facts
          under it, then the two actions. */}
      <div className="relative h-24 sm:h-36">
        <Photo
          placeholder
          src={photo}
          className="absolute inset-0 h-full w-full object-cover"
          fallback={
            <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-br from-sea-50 to-mist-100 p-2.5 text-4xl leading-none">
              {place ? <Flag code={place.countryCode} size={28} /> : null}
            </div>
          }
        />
        {place?.classification && (
          <span
            className={`absolute start-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm sm:start-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-xs ${
              place.inSeason ? "bg-emerald-100 text-emerald-900" : "bg-white/90 text-navy-700"
            }`}
          >
            <span className="hidden sm:inline">{monthLabel ? `${monthLabel}: ` : ""}</span>
            {CLASS_DOT[place.classification]} {dict.travelSeasons.classes[place.classification]}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="truncate font-display text-base font-extrabold text-navy-900 sm:text-xl">{name}</p>
        {countryName && <p className="truncate text-xs font-semibold text-navy-500 sm:text-sm">{countryName}</p>}
        {/* Weather that month and the visa, side by side. */}
        <div className="mt-2 flex flex-wrap items-center gap-1 sm:mt-3 sm:gap-1.5">
          {place?.seasonName && (
            <span className="max-w-full truncate rounded-full bg-sun-50 px-2 py-0.5 text-[11px] font-bold text-sun-900 ring-1 ring-sun-200 sm:px-2.5 sm:py-1 sm:text-xs">
              {place.seasonName.icon} {isAr ? place.seasonName.ar : place.seasonName.en}
            </span>
          )}
          {place?.high !== undefined && (
            <span className="rounded-full bg-mist-50 px-2 py-0.5 text-[11px] font-bold text-navy-800 ring-1 ring-mist-200 sm:px-2.5 sm:py-1 sm:text-xs" dir="ltr">
              🌡{" "}
              {place.low !== undefined
                ? dict.travelSeasons.highLow.replace("{low}", String(Math.round(place.low))).replace("{high}", String(Math.round(place.high)))
                : `${Math.round(place.high)}°`}
            </span>
          )}
          {place?.rainyDays !== undefined && (
            <span className="hidden rounded-full bg-mist-50 px-2.5 py-1 text-xs font-bold text-navy-800 ring-1 ring-mist-200 sm:inline">
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
          {/* A Saudi city needs no visa line for a Saudi traveller (Jeddah
              from Riyadh said "visa: check before travel", 13 Oct). */}
          {place?.countryCode === "SA" ? null : place?.visa ? (
            <VisaBadge category={place.visa} label={visaLabels[place.visa]} className="!px-2 !py-0.5 !text-[11px] sm:!px-2.5 sm:!py-1 sm:!text-xs" />
          ) : place ? (
            // Not confirmed at the official source yet: say so, and where to check.
            <VisaDetailsButton
              countryCode={place.countryCode}
              locale={locale}
              className="rounded-full bg-mist-100 px-2.5 py-1 text-xs font-bold text-navy-700 ring-1 ring-mist-200 hover:ring-navy-300"
            >
              🛂 {d.visaCheck}
            </VisaDetailsButton>
          ) : null}
        </div>

        {/* The fare that chose this place, said plainly (owner, 20 Oct: show
            the price and that it fits). «احجز» opens every flight live. */}
        {suggestion.flight && suggestion.totalPrice > 0 && (
          <div className="mt-3 rounded-xl bg-sea-50/70 px-2.5 py-2 ring-1 ring-sea-100 sm:px-3">
            <p className="text-[11px] font-bold text-navy-600">{suggestion.flight.nearDays ? d.fareNear : d.fareSeen}</p>
            <p className="font-display text-lg font-black text-navy-950 sm:text-xl">
              <bdi dir="ltr">{`${Math.round(suggestion.totalPrice).toLocaleString("en-US")} ${currency}`}</bdi>
            </p>
            <p className="text-[11px] text-navy-500">{returnDate ? d.fareFor : d.fareForOneWay}</p>
            {suggestion.withinBudget && <p className="mt-0.5 text-[11px] font-extrabold text-sea-700">{d.fareWithin}</p>}
          </div>
        )}

        <div className="mt-auto space-y-2 pt-3 sm:pt-4">
          {(() => {
            const main =
              "block w-full rounded-xl bg-sun-400 px-2 py-2.5 text-center text-xs font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300 sm:px-4 sm:py-3 sm:text-sm";
            const second =
              "block w-full rounded-xl bg-white px-2 py-2 text-center text-xs font-bold text-navy-900 ring-1 ring-navy-900/15 transition hover:bg-mist-50 sm:bg-navy-900 sm:px-4 sm:py-2.5 sm:text-sm sm:text-white sm:ring-0 sm:hover:bg-navy-800";
            const flight = (cls: string) => (
              <Link key="f" href={`/${locale}/results?${flightParams.toString()}`} className={cls}>
                ✈️ <span className="sm:hidden">{d.bookFlightShort}</span>
                <span className="hidden sm:inline">{d.bookFlight}</span>
              </Link>
            );
            const hotel = (cls: string) => (
              <Link key="h" href={hotelHref} className={cls}>
                🏨 <span className="sm:hidden">{d.hotelsTiny}</span>
                <span className="hidden sm:inline">{d.hotelIn.replace("{city}", name)}</span>
              </Link>
            );
            return hotelFirst ? [hotel(main), flight(second)] : [flight(main), hotel(second)];
          })()}
          {place && (
            <Link
              href={`/${locale}/attractions/${place.countryCode}/${place.citySlug}`}
              className="hidden text-center text-xs font-bold text-sea-700 hover:underline sm:block"
            >
              {d.aboutCity.replace("{city}", name)}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
