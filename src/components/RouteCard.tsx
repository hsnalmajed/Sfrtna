import Link from "next/link";
import type { Locale, RouteSuggestion, TravelerCounts } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { serializeChildrenAges } from "@/lib/searchParamsUtil";
import { findCountry } from "@/lib/countries";
import { countLabel } from "@/lib/format";
import { monthName } from "@/lib/seasons";
import Photo from "@/components/Photo";
import VisaBadge from "@/components/VisaBadge";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * One suggested route across several countries: home → A → B (→ C) → home.
 *
 * Read top to bottom the way the trip happens — the countries with how long
 * in each and whether it is a good time there, then every flight with its
 * day and its own button to the live price. The route was chosen because
 * the fares seen for its flights lately fit the budget; those seen fares are
 * not shown, since the site prints the live price or none.
 */
export default function RouteCard({
  route,
  locale,
  originLabel,
  travelers,
  currency,
  directOnly,
  baggageIncluded,
  photos,
}: {
  route: RouteSuggestion;
  locale: Locale;
  originLabel: string;
  travelers: TravelerCounts;
  currency: string;
  directOnly: boolean;
  baggageIncluded: boolean;
  photos: Record<string, string>;
}) {
  const dict = getDictionary(locale);
  const d = dict.discoverResults;
  const isAr = locale === "ar";
  const arrow = isAr ? "←" : "→";
  const dateLabel = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(isAr ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const nameOf = (code: string) => {
    const stop = route.stops.find((s) => s.code === code);
    if (!stop) return originLabel;
    return isAr ? stop.nameAr : stop.nameEn;
  };
  const party = {
    adults: String(travelers.adults),
    childrenAges: serializeChildrenAges(travelers.childrenAges),
    infants: String(travelers.infants),
  };
  const visaLabels = {
    free: dict.visa.statusFree,
    arrival: dict.visa.statusArrival,
    eta: dict.visa.statusEta,
    required: dict.visa.statusRequired,
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${
        route.withinBudget ? "ring-navy-950/10" : "ring-rose-200"
      }`}
    >
      {/* The route, as a line: home → … → home, and its price. */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-950 px-5 py-4 text-white">
        <p className="font-display text-lg font-black">
          {[originLabel, ...route.stops.map((s) => (isAr ? s.nameAr : s.nameEn)), originLabel].join(` ${arrow} `)}
        </p>
      </div>

      {/* The countries. */}
      <div className={`grid gap-3 p-4 ${route.stops.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {route.stops.map((s) => {
          const name = isAr ? s.nameAr : s.nameEn;
          const country = s.place ? findCountry(s.place.countryCode) : undefined;
          const photo = s.place ? photos[`${s.place.countryCode}/${s.place.citySlug}`] : undefined;
          const hotelParams = new URLSearchParams({
            product: "hotels",
            hmode: "discover",
            city: s.place?.cityNameEn ?? s.nameEn,
            checkIn: s.arrive,
            checkOut: addDays(s.arrive, s.nights),
            ...party,
          });
          return (
            <div key={s.code} className="overflow-hidden rounded-xl ring-1 ring-mist-200">
              <div className="relative h-28">
                <Photo
                  src={photo}
                  className="absolute inset-0 h-full w-full object-cover"
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-700 to-navy-990 text-4xl">
                      {s.emoji}
                    </div>
                  }
                />
                <div className="scrim-soft absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-display text-base font-black text-white">{name}</p>
                  <p className="text-xs font-semibold text-white/80">
                    {country ? (isAr ? country.nameAr : country.nameEn) : ""}
                    {country ? " · " : ""}
                    {countLabel(s.nights, { one: d.nightsOne, two: d.nightsTwo, few: d.nightsFew, many: d.nightsMany })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 p-3">
                {s.place?.inSeason !== undefined && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      s.place.inSeason ? "bg-emerald-100 text-emerald-900" : "bg-mist-100 text-navy-700"
                    }`}
                  >
                    {s.place.inSeason ? "☀️ " : ""}
                    {(s.place.inSeason ? d.inSeason : d.notInSeason).replace("{month}", monthName(Number(s.arrive.slice(5, 7)), locale))}
                    {s.place.seasonKind && ` · ${(dict.citySeasons.kinds as Record<string, string>)[s.place.seasonKind]}`}
                  </span>
                )}
                {s.place?.high !== undefined && (
                  <span className="rounded-full bg-mist-50 px-2.5 py-1 text-xs font-bold text-navy-800 ring-1 ring-mist-200">
                    {dict.home.seasonHigh.replace("{high}", String(Math.round(s.place.high)))}
                  </span>
                )}
                {s.place?.visa && (
                  <VisaBadge category={s.place.visa} label={visaLabels[s.place.visa]} className="!px-2.5 !py-1" />
                )}
                <a href={`/${locale}?${hotelParams.toString()}#plan`} className="ms-auto text-xs font-bold text-sea-700 hover:underline">
                  🏨 {d.hotelShort.replace("{city}", name)}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Every flight, in order, each bookable on its own. */}
      <div className="px-4 pb-4">
        <p className="mb-2 text-xs font-bold text-navy-500">{d.flightsHeading}</p>
        <ol className="divide-y divide-mist-100 rounded-xl ring-1 ring-mist-200">
          {route.legs.map((leg, i) => {
            const href = `/${locale}/results?${new URLSearchParams({
              tripType: "flight",
              tripRoute: "oneway",
              mode: "known",
              origin: leg.from,
              destination: leg.to,
              departDate: leg.date,
              returnDate: "",
              ...party,
              currency,
              directOnly: String(directOnly),
              baggageIncluded: String(baggageIncluded),
            })}`;
            return (
              <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sun-400 text-xs font-black text-navy-950">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-navy-950">
                    {nameOf(leg.from)} {arrow} {nameOf(leg.to)}
                    <span className="ms-2 font-semibold text-navy-500">{dateLabel(leg.date)}</span>
                  </p>
                </div>
                <Link
                  href={href}
                  className="rounded-lg bg-sun-400 px-3 py-2 text-xs font-extrabold text-navy-950 transition hover:bg-sun-300"
                >
                  {dict.multicity.bookLeg}
                </Link>
              </li>
            );
          })}
        </ol>

      </div>
    </article>
  );
}
