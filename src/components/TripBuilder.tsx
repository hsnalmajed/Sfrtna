"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import { countLabel, formatDuration } from "@/lib/format";
import type { FlightOffer, HotelOffer, Locale, SearchParams, TripType } from "@/lib/types";
import { flightBookingHandoff, hotelBookingHandoff } from "@/lib/affiliateLinks";
import AirlineLogo from "@/components/ui/AirlineLogo";
import HotelThumb from "@/components/ui/HotelThumb";
import BudgetNotice from "@/components/BudgetNotice";
import { budgetStanding, money } from "@/lib/budget";

/**
 * One trip, priced — not a wall of near-identical packages.
 *
 * A flight list crossed with a hotel list produces twenty-five cards that
 * differ by a few riyals, and a visitor has to hold all of them in their head
 * to work out what any one choice costs. So we make the decision for them
 * first: the cheapest flight with the cheapest hotel, shown as a single trip
 * with a single total.
 *
 * Everything else is reachable, but as an *answer to a question*: "what else
 * is there, and what would it cost me?" Each alternative is labelled with its
 * difference from the option currently selected — +٤٥٠ ر.س for the earlier
 * flight, ٠ for a hotel at the same rate — because that difference is the
 * number someone is actually deciding on. An absolute price makes them do the
 * subtraction themselves, every time.
 *
 * The deltas are recomputed against whatever is selected now, not against the
 * original cheapest option, so after swapping the flight the hotel list still
 * reads as "compared with what I have".
 *
 * Every offer is scanned rather than read: the carrier's logo, a departure
 * and arrival time joined by a line, then two chips that answer the only
 * questions a fare list gets asked — does it stop, and is a bag included.
 * What a traveller compares on is never left in the same grey as everything
 * else.
 */

type Picker = "flight" | "hotel" | null;
type FlightSort = "cheapest" | "fastest";
type HotelSort = "cheapest" | "topRated";

type Dict = ReturnType<typeof getDictionary>;

function formatTime(iso: string, locale: Locale) {
  try {
    return new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortDate(iso: string, locale: Locale) {
  try {
    // "ar-SA" would format this in the Hijri calendar — which is not the
    // calendar the traveller picked their dates in, so 1 October would come
    // back as 20 Rabi al-Akhir and read as a different trip entirely.
    return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function stopsLabel(stops: number, dict: Dict): string {
  if (stops <= 0) return dict.results.directFlight;
  if (stops === 1) return dict.results.oneStop;
  if (stops === 2) return dict.results.twoStops;
  return dict.results.manyStops.replace("{count}", String(stops));
}

/** "شامل مسافرَين" — the fare already covers everyone on the search. */
function travelersLabel(travelers: number, dict: Dict): string {
  return countLabel(Math.max(1, travelers), {
    one: dict.results.travelersOne,
    two: dict.results.travelersTwo,
    few: dict.results.travelersFew,
    many: dict.results.travelersMany,
  });
}

/** "٧ ليالٍ" — derived from the dates the traveller searched with. */
function nightsLabel(nights: number, dict: Dict): string {
  return countLabel(Math.max(1, nights), {
    one: dict.results.nightsOne,
    two: dict.results.nightsTwo,
    few: dict.results.nightsFew,
    many: dict.results.nightsMany,
  });
}

/** A small status chip. Colour is never the only signal — each carries words. */
function Chip({ children, tone }: { children: React.ReactNode; tone: "good" | "warn" | "info" | "mute" }) {
  const tones = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warn: "bg-amber-50 text-amber-800 ring-amber-100",
    info: "bg-sea-50 text-sea-700 ring-sea-100",
    mute: "bg-gray-100 text-gray-500 ring-gray-200",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * The price difference, as a signed amount.
 *
 * Forced to LTR: the sign has to stay glued to the front of the number, and
 * an Arabic paragraph would otherwise push a leading "+" to the wrong end of
 * "+450 SAR".
 */
function DeltaChip({ diff, currency, sameLabel }: { diff: number; currency: string; sameLabel: string }) {
  const tone =
    diff > 0
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : diff < 0
        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
        : "bg-gray-100 text-gray-500 ring-gray-200";

  return (
    <span
      dir="ltr"
      title={diff === 0 ? sameLabel : undefined}
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${tone}`}
    >
      {diff > 0 ? "+" : diff < 0 ? "−" : ""}
      {Math.abs(diff).toLocaleString()} {currency}
    </span>
  );
}

/** Departure and arrival joined by a line, with the duration written on it. */
function FlightTimeline({ flight, locale, dict }: { flight: FlightOffer; locale: Locale; dict: Dict }) {
  /**
   * A price-only source gives a fare, a carrier and a departure — no arrival,
   * no duration, no stop count. Drawing the timeline anyway would mean
   * inventing three numbers out of a great-circle distance and presenting
   * them as the airline's schedule. So the timeline is simply absent, and the
   * card says where the price came from instead.
   */
  if (flight.priceOnly) {
    return (
      <div className="mt-1.5 max-w-[17rem]">
        <p className="text-sm font-semibold text-gray-700">
          {shortDate(flight.departTime, locale)}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
          {flight.origin} → {flight.destination} · {dict.results.priceOnlyNote}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-1.5 max-w-[17rem]">
      <div className="flex items-center gap-2.5">
        <span className="text-sm font-extrabold tabular-nums text-gray-900">
          {formatTime(flight.departTime, locale)}
        </span>
        <span className="flex min-w-[54px] flex-1 items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
          <span className="h-px flex-1 bg-gray-200" />
          {flight.stops > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
          <span className="h-px flex-1 bg-gray-200" />
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
        </span>
        <span className="text-sm font-extrabold tabular-nums text-gray-900">
          {formatTime(flight.arriveTime, locale)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between text-[11px] font-semibold text-gray-500">
        <span>{flight.origin}</span>
        <span>{formatDuration(flight.durationMinutes, locale)}</span>
        <span>{flight.destination}</span>
      </div>
      {flight.stops > 0 && flight.layoverCity && (
        <p className="mt-1 text-[11px] text-gray-500">
          {dict.results.layoverIn
            .replace("{city}", flight.layoverCity)
            .replace(
              "{duration}",
              flight.layoverDurationMinutes ? formatDuration(flight.layoverDurationMinutes, locale) : ""
            )}
        </p>
      )}
    </div>
  );
}

function FlightChips({ flight, dict }: { flight: FlightOffer; dict: Dict }) {
  // A chip is a statement of fact. "No checked bag" is a different claim from
  // "we were not told about the bag", and only the first one belongs here —
  // so a price-only offer shows the chips it can stand behind and no others.
  const canStateStops = !flight.priceOnly || flight.stopsKnown;
  const canStateBaggage = !flight.priceOnly;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {canStateStops && (
        <Chip tone={flight.stops === 0 ? "good" : "warn"}>
          <span aria-hidden="true">{flight.stops === 0 ? "➜" : "⇄"}</span>
          {stopsLabel(flight.stops, dict)}
        </Chip>
      )}
      {canStateBaggage && (
        <Chip tone={flight.baggageIncluded ? "info" : "mute"}>
          <span aria-hidden="true">🧳</span>
          {flight.baggageIncluded ? dict.results.baggageYes : dict.results.baggageNo}
        </Chip>
      )}
      {flight.priceOnly && (
        <Chip tone="mute">
          <span aria-hidden="true">📅</span>
          {dict.results.priceObserved}
        </Chip>
      )}
      {flight.datesApproximate && (
        <Chip tone="warn">
          <span aria-hidden="true">⚠️</span>
          {dict.results.approxDatesNote}
        </Chip>
      )}
    </div>
  );
}

function HotelChips({ hotel, dict }: { hotel: HotelOffer; dict: Dict }) {
  // A cached price comes with a name, a star rating and nothing else. The
  // chips below each state a fact about the room, so they are shown only for
  // a source that actually told us one.
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {!hotel.priceOnly && (
        <Chip tone={hotel.breakfastIncluded ? "good" : "mute"}>
          <span aria-hidden="true">🍳</span>
          {hotel.breakfastIncluded ? dict.results.breakfastYes : dict.results.breakfastNo}
        </Chip>
      )}
      {!hotel.priceOnly && (
        <Chip tone="info">
          <span aria-hidden="true">📍</span>
          {dict.results.distanceFromCenter.replace("{km}", String(hotel.distanceFromCenterKm))}
        </Chip>
      )}
      <Chip tone="mute">
        <span aria-hidden="true">🛏️</span>
        {hotel.priceOnly ? dict.results.hotelPriceOnlyNote : dict.roomType[hotel.roomType]}
        {/* Above one, the party needs more than one unit and the total
            already reflects that — saying so is the difference between a
            price that looks wrong and one that adds up. */}
        {(hotel.units ?? 1) > 1 &&
          ` ${dict.results.roomUnits.replace("{count}", String(hotel.units))}`}
      </Chip>
    </div>
  );
}

/** The hotel's class, in words as well as stars. */
function hotelClassLabel(stars: number, dict: Dict): string {
  if (stars === 1) return dict.results.hotelClassStarsOne;
  if (stars === 2) return dict.results.hotelClassStarsTwo;
  return dict.results.hotelClassStars.replace("{count}", String(stars));
}

/** What a 0-10 guest score actually means. */
function ratingWord(rating: number, dict: Dict): string {
  if (rating >= 8.5) return dict.results.ratingExcellent;
  if (rating >= 7.5) return dict.results.ratingVeryGood;
  return dict.results.ratingGood;
}

/**
 * Name, class and guest score — three separate facts, shown as three.
 *
 * They used to run together as "★ · 5 ليالي", which reads as a rating of
 * five for a hotel that has one star, next to a stay length that has nothing
 * to do with either. Stars now carry the words "1-star hotel" beside them,
 * the guest score says it is a guest score and what it means, and the night
 * count has moved out of this line entirely.
 */
function HotelHeading({ hotel, dict }: { hotel: HotelOffer; dict: Dict }) {
  return (
    <>
      <p className="text-base font-bold leading-snug text-gray-900">{hotel.name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {hotel.stars > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600">
            <span className="text-amber-500" aria-hidden="true">
              {"★".repeat(Math.min(5, hotel.stars))}
              <span className="text-gray-300">{"★".repeat(Math.max(0, 5 - hotel.stars))}</span>
            </span>
            {hotelClassLabel(hotel.stars, dict)}
          </span>
        )}
        {hotel.rating != null && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-900 px-2 py-0.5 text-[11px] font-extrabold text-white">
            {dict.results.guestRating.replace("{rating}", String(hotel.rating))}
            <span className="font-semibold text-white/70">{ratingWord(hotel.rating, dict)}</span>
          </span>
        )}
      </div>
    </>
  );
}

export default function TripBuilder({
  flights,
  hotels,
  tripType,
  budgetTotal,
  currency,
  locale,
  travelers,
  departDate,
  returnDate,
  search,
  destinationName,
}: {
  flights: FlightOffer[];
  hotels: HotelOffer[];
  tripType: TripType;
  budgetTotal: number;
  currency: string;
  locale: Locale;
  /** Everyone on the booking — the fares below already cover all of them. */
  travelers: number;
  departDate: string;
  returnDate?: string;
  /** The search this trip came out of, for building the partner handoff. */
  search: SearchParams;
  /** The destination city as a person would write it, for the hotel search. */
  destinationName: string;
}) {
  const dict = getDictionary(locale);

  const needsFlight = tripType !== "hotel";
  const needsHotel = tripType !== "flight";

  /**
   * Narrowing, before anything is chosen.
   *
   * The search form already asks about non-stop, baggage and breakfast, but
   * those answers are locked in at search time — changing your mind meant
   * going back and running the whole search again. These do the same work on
   * what is already loaded, instantly, and the cheapest-trip default
   * recomputes against whatever survives.
   *
   * Deliberately four switches and not a panel: every one of them is a
   * yes/no a traveller already has an opinion about, and a filter nobody can
   * answer at a glance is a filter nobody uses.
   */
  const [onlyDirect, setOnlyDirect] = useState(false);
  const [onlyBaggage, setOnlyBaggage] = useState(false);
  const [onlyBreakfast, setOnlyBreakfast] = useState(false);

  const visibleFlights = useMemo(
    () =>
      flights.filter(
        (f) => (!onlyDirect || f.stops === 0) && (!onlyBaggage || f.baggageIncluded)
      ),
    [flights, onlyDirect, onlyBaggage]
  );
  const visibleHotels = useMemo(
    () => hotels.filter((h) => !onlyBreakfast || h.breakfastIncluded),
    [hotels, onlyBreakfast]
  );

  // The opening position: cheapest of each. Sorting a copy — the arrays come
  // from state upstream and must not be reordered under it.
  const sortedFlights = useMemo(
    () => [...visibleFlights].sort((a, b) => a.price - b.price),
    [visibleFlights]
  );
  const sortedHotels = useMemo(
    () => [...visibleHotels].sort((a, b) => a.totalPrice - b.totalPrice),
    [visibleHotels]
  );

  /**
   * The budget, applied to the results rather than printed beside them.
   *
   * This page used to show every offer the providers returned and mark the
   * chosen combination green or red afterwards, which turns the number the
   * traveller typed into a label on somebody else's answer. Here the budget
   * decides what is on the page.
   *
   * An option is judged against the cheapest possible partner, not against
   * whatever is selected: a flight belongs on the list if *some* affordable
   * trip contains it, and pairing it with the cheapest hotel is the test for
   * that. Judging it against the current selection would make options appear
   * and vanish as the traveller browsed, which is unusable.
   *
   * `allowOver` is the traveller's own decision, never the default — see
   * budget.ts for why the tolerance is fixed and small.
   */
  const [allowOver, setAllowOver] = useState(false);

  const floorFlight = needsFlight ? (sortedFlights[0]?.price ?? 0) : 0;
  const floorHotel = needsHotel ? (sortedHotels[0]?.totalPrice ?? 0) : 0;
  const standing = budgetStanding(
    budgetTotal,
    floorFlight + floorHotel,
    allowOver,
    currency
  );

  // When the budget cannot buy even the cheapest trip, filtering would empty
  // the page. The notice above explains the gap instead, and the offers stay
  // so the traveller can see what they are being asked to pay for.
  const budgetApplies = !standing.unlimited && standing.shortfall === 0;

  const cheapestFlights = useMemo(
    () =>
      budgetApplies
        ? sortedFlights.filter((f) => f.price + floorHotel <= standing.ceiling)
        : sortedFlights,
    [sortedFlights, budgetApplies, floorHotel, standing.ceiling]
  );
  const cheapestHotels = useMemo(
    () =>
      budgetApplies
        ? sortedHotels.filter((h) => h.totalPrice + floorFlight <= standing.ceiling)
        : sortedHotels,
    [sortedHotels, budgetApplies, floorFlight, standing.ceiling]
  );

  // How many more would appear if the tolerance were allowed — counted only
  // up to the tolerance, so the button can never promise more than it shows.
  const nearbyCount = useMemo(() => {
    if (!budgetApplies || allowOver) return 0;
    const limit = budgetTotal + standing.allowance;
    const f = sortedFlights.filter(
      (x) => x.price + floorHotel > budgetTotal && x.price + floorHotel <= limit
    ).length;
    const h = sortedHotels.filter(
      (x) => x.totalPrice + floorFlight > budgetTotal && x.totalPrice + floorFlight <= limit
    ).length;
    return f + h;
  }, [
    budgetApplies,
    allowOver,
    sortedFlights,
    sortedHotels,
    budgetTotal,
    standing.allowance,
    floorFlight,
    floorHotel,
  ]);

  const [flightId, setFlightId] = useState<string | null>(null);
  const [hotelId, setHotelId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [flightSort, setFlightSort] = useState<FlightSort>("cheapest");
  const [hotelSort, setHotelSort] = useState<HotelSort>("cheapest");

  // Stable, so the dialog can attach its key listener once on open rather
  // than re-subscribing (and re-focusing itself) on every render.
  const closePicker = useCallback(() => setPicker(null), [setPicker]);

  // Derived rather than stored, so the first render after the offers arrive
  // already shows the cheapest trip without an effect writing state.
  const flight = needsFlight
    ? (cheapestFlights.find((f) => f.id === flightId) ?? cheapestFlights[0])
    : undefined;
  const hotel = needsHotel ? (cheapestHotels.find((h) => h.id === hotelId) ?? cheapestHotels[0]) : undefined;

  const total = (flight?.price ?? 0) + (hotel?.totalPrice ?? 0);
  const withinBudget = budgetTotal <= 0 || total <= budgetTotal;
  const remaining = budgetTotal - total;

  const flightOptions = useMemo(() => {
    const arr = [...cheapestFlights];
    if (flightSort === "fastest") arr.sort((a, b) => a.durationMinutes - b.durationMinutes);
    return arr;
  }, [cheapestFlights, flightSort]);

  const hotelOptions = useMemo(() => {
    const arr = [...cheapestHotels];
    if (hotelSort === "topRated") {
      arr.sort((a, b) => (b.rating ?? b.stars) - (a.rating ?? a.stars));
    }
    return arr;
  }, [cheapestHotels, hotelSort]);

  const otherFlights = Math.max(0, cheapestFlights.length - 1);
  const otherHotels = Math.max(0, cheapestHotels.length - 1);

  const isCheapestTrip =
    (!flight || flight.id === cheapestFlights[0]?.id) && (!hotel || hotel.id === cheapestHotels[0]?.id);

  // Rebuilt whenever the traveller swaps a flight or a hotel, so the handoff
  // always points at what is currently on screen.
  const flightHandoff = useMemo(() => flightBookingHandoff(search, flight), [search, flight]);
  const hotelHandoff = useMemo(
    () => hotelBookingHandoff(search, destinationName, hotel),
    [search, destinationName, hotel]
  );
  // On a phone there is room for one button. The hotel is the better default:
  // a flight handoff only ever opens a search, whereas the hotel link carries
  // the property name the traveller just chose.
  const primaryHandoff = hotelHandoff ?? flightHandoff;

  const travelersText = travelersLabel(travelers, dict);
  const stayDates = returnDate
    ? dict.results.stayDates
        .replace("{from}", shortDate(departDate, locale))
        .replace("{to}", shortDate(returnDate, locale))
    : "";

  const anyFilter = onlyDirect || onlyBaggage || onlyBreakfast;

  /**
   * What the total covers, said once above everything.
   *
   * A price with no headcount beside it reads as per-person and gets doubled
   * in someone's head; a hotel total with no night count reads as a nightly
   * rate. Both were only stated deep inside the card.
   */
  const scopeLine = dict.results.priceScope
    .replace("{travelers}", travelersText)
    .replace("{nights}", hotel ? ` · ${nightsLabel(hotel.nights, dict)}` : "");

  const filterChip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
      on
        ? "bg-navy-900 text-white ring-1 ring-navy-900"
        : "bg-white text-navy-600 ring-1 ring-mist-300 hover:ring-navy-300"
    }`;

  // Filters are shown even when nothing survives them, because the way out of
  // an empty result is to turn one off — hiding the switches would strand the
  // traveller on a blank page.
  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-navy-500">{dict.results.filterLabel}</span>
      {needsFlight && (
        <>
          <button type="button" aria-pressed={onlyDirect} onClick={() => setOnlyDirect((v) => !v)} className={filterChip(onlyDirect)}>
            <span aria-hidden="true">➜</span>
            {dict.results.filterDirect}
          </button>
          <button type="button" aria-pressed={onlyBaggage} onClick={() => setOnlyBaggage((v) => !v)} className={filterChip(onlyBaggage)}>
            <span aria-hidden="true">🧳</span>
            {dict.results.filterBaggage}
          </button>
        </>
      )}
      {needsHotel && (
        <button type="button" aria-pressed={onlyBreakfast} onClick={() => setOnlyBreakfast((v) => !v)} className={filterChip(onlyBreakfast)}>
          <span aria-hidden="true">🍳</span>
          {dict.results.filterBreakfast}
        </button>
      )}
      <span className="ms-auto text-xs font-semibold text-navy-500">{scopeLine}</span>
    </div>
  );

  /**
   * The budget, said out loud.
   *
   * Without this line the filtering above would be invisible: a traveller
   * would see six hotels, not know that four more had been held back, and
   * have no way to ask for them. The bar states the rule and offers the one
   * exception, with the tolerance named in money rather than left vague.
   */
  const budgetBar = budgetApplies && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-navy-50 px-4 py-3 ring-1 ring-navy-100">
      <span className="text-xs font-bold text-navy-700">
        {allowOver
          ? dict.results.budgetIncludingNearby.replace(
              "{amount}",
              money(standing.allowance, currency)
            )
          : dict.results.budgetOnlyAffordable.replace("{budget}", money(budgetTotal, currency))}
      </span>
      {allowOver ? (
        <button
          type="button"
          onClick={() => setAllowOver(false)}
          className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-navy-700 ring-1 ring-navy-200 transition hover:ring-navy-400"
        >
          {dict.results.budgetHideNearby}
        </button>
      ) : (
        nearbyCount > 0 && (
          <button
            type="button"
            onClick={() => setAllowOver(true)}
            className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-navy-700 ring-1 ring-navy-200 transition hover:ring-navy-400"
          >
            {dict.results.budgetShowNearby
              .replace("{amount}", money(standing.allowance, currency))
              .replace(
                "{count}",
                countLabel(nearbyCount, {
                  one: dict.results.budgetNearbyOne,
                  two: dict.results.budgetNearbyTwo,
                  few: dict.results.budgetNearbyFew,
                  many: dict.results.budgetNearbyMany,
                })
              )}
          </button>
        )
      )}
    </div>
  );

  const shortfallNotice = !standing.unlimited && standing.shortfall > 0 && (
    <BudgetNotice
      locale={locale}
      currency={currency}
      budgetTotal={budgetTotal}
      cheapest={standing.floor}
    />
  );

  if (!flight && !hotel) {
    return (
      <div className="space-y-4">
        {shortfallNotice}
        {filterBar}
        {anyFilter && (
          <p className="card px-4 py-10 text-center text-sm text-navy-500">
            {dict.results.filterNone}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {shortfallNotice}
      {filterBar}
      {budgetBar}

      {/* ---- The trip as it currently stands ---- */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-brand-800 to-brand-950 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
              {isCheapestTrip ? dict.results.cheapestTrip : dict.results.yourTrip}
            </p>
            <p dir="ltr" className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
              {total.toLocaleString()} {currency}
            </p>
            <p className="mt-0.5 text-xs text-white/60">
              {travelersText}
              {hotel ? ` · ${nightsLabel(hotel.nights, dict)}` : ""}
            </p>
          </div>
          <div className="text-end">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                withinBudget ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"
              }`}
            >
              {withinBudget ? dict.results.withinBudget : dict.results.overBudget}
            </span>
            {budgetTotal > 0 && (
              <p className="mt-1.5 text-xs text-white/60">
                {dict.results.remainingBudget}:{" "}
                <span dir="ltr" className="font-bold text-white/90">
                  {remaining.toLocaleString()} {currency}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {flight && (
            <section className="px-5 py-4 sm:px-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {dict.results.flightOption}
              </p>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <AirlineLogo code={flight.airlineCode} name={flight.airline} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-gray-900">{flight.airline}</p>
                    <FlightTimeline flight={flight} locale={locale} dict={dict} />
                    <FlightChips flight={flight} dict={dict} />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span dir="ltr" className="text-lg font-extrabold text-gray-900">
                    {flight.price.toLocaleString()} {flight.currency}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500">{travelersText}</span>
                  {/* Where the total came from. A partner's page shows one
                      seat's fare, and a traveller comparing the two numbers
                      deserves to see the arithmetic rather than suspect us. */}
                  {flight.pricePerPerson !== undefined &&
                    flight.pricePerPerson !== flight.price && (
                      <span dir="ltr" className="text-[11px] text-gray-400">
                        {dict.results.perPersonFare
                          .replace("{price}", `${flight.pricePerPerson.toLocaleString()} ${flight.currency}`)
                          .replace("{count}", String(Math.round(flight.price / flight.pricePerPerson)))}
                      </span>
                    )}
                  <ChangeButton
                    label={dict.results.changeFlight}
                    open={picker === "flight"}
                    onClick={() => setPicker(picker === "flight" ? null : "flight")}
                    count={
                      otherFlights > 0
                        ? countLabel(otherFlights, {
                            one: dict.results.otherOptionsOne,
                            two: dict.results.otherOptionsTwo,
                            few: dict.results.otherOptionsFew,
                            many: dict.results.otherOptionsMany,
                          })
                        : null
                    }
                  />
                </div>
              </div>
            </section>
          )}

          {hotel && (
            <section className="px-5 py-4 sm:px-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {dict.results.hotelOption}
              </p>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <HotelThumb photoUrl={hotel.photoUrl} stars={hotel.stars} className="h-20 w-24" />
                  <div className="min-w-0 flex-1">
                    <HotelHeading hotel={hotel} dict={dict} />
                    <p className="mt-1 text-sm text-gray-500">
                      <span dir="ltr">
                        {hotel.pricePerNight.toLocaleString()} {hotel.currency}
                      </span>{" "}
                      / {dict.results.perNight} · {nightsLabel(hotel.nights, dict)}
                      {stayDates ? ` · ${stayDates}` : ""}
                    </p>
                    <HotelChips hotel={hotel} dict={dict} />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span dir="ltr" className="text-lg font-extrabold text-gray-900">
                    {hotel.totalPrice.toLocaleString()} {hotel.currency}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500">
                    {dict.results.totalForStay} · {nightsLabel(hotel.nights, dict)}
                  </span>
                  <ChangeButton
                    label={dict.results.changeHotel}
                    open={picker === "hotel"}
                    onClick={() => setPicker(picker === "hotel" ? null : "hotel")}
                    count={
                      otherHotels > 0
                        ? countLabel(otherHotels, {
                            one: dict.results.otherHotelsOne,
                            two: dict.results.otherHotelsTwo,
                            few: dict.results.otherHotelsFew,
                            many: dict.results.otherHotelsMany,
                          })
                        : null
                    }
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ---- The way out ----------------------------------------------
            Sfrtna compares and hands over; it never takes a booking. For a
            while this row did not exist at all, so the site's only job had
            no button. Each partner is named *before* the traveller leaves,
            and the price disclaimer is not fine print: our number came from
            a different source and the partner's is the one they will pay. */}
        {(flightHandoff || hotelHandoff) && (
          <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              {flightHandoff && (
                <BookingButton
                  href={flightHandoff.url}
                  label={dict.results.bookFlight}
                  note={dict.results.handoffNote.replace("{partner}", flightHandoff.partner)}
                />
              )}
              {hotelHandoff && (
                <BookingButton
                  href={hotelHandoff.url}
                  label={dict.results.bookHotel}
                  note={dict.results.handoffNote.replace("{partner}", hotelHandoff.partner)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---- The alternatives, priced against what is selected ---- */}
      {picker === "flight" && flight && (
        <OptionList
          title={dict.results.pickFlightTitle}
          note={dict.results.deltaNote}
          onClose={closePicker}
          closeLabel={dict.results.closeOptions}
          sortOptions={[
            { key: "cheapest", label: dict.results.sortCheapest },
            { key: "fastest", label: dict.results.sortFastest },
          ]}
          sort={flightSort}
          onSort={(k) => setFlightSort(k as FlightSort)}
        >
          {flightOptions.map((option) => (
            <OptionRow
              key={option.id}
              selected={option.id === flight.id}
              cheapest={option.id === cheapestFlights[0]?.id}
              onSelect={() => {
                setFlightId(option.id);
                setPicker(null);
              }}
              media={<AirlineLogo code={option.airlineCode} name={option.airline} className="h-11 w-11" />}
              heading={<p className="text-base font-bold text-gray-900">{option.airline}</p>}
              body={
                <>
                  <FlightTimeline flight={option} locale={locale} dict={dict} />
                  <FlightChips flight={option} dict={dict} />
                </>
              }
              price={`${option.price.toLocaleString()} ${option.currency}`}
              priceNote={travelersText}
              diff={option.price - flight.price}
              currency={option.currency}
              dict={dict}
            />
          ))}
        </OptionList>
      )}

      {picker === "hotel" && hotel && (
        <OptionList
          title={dict.results.pickHotelTitle}
          note={dict.results.deltaNote}
          onClose={closePicker}
          closeLabel={dict.results.closeOptions}
          sortOptions={[
            { key: "cheapest", label: dict.results.sortCheapest },
            { key: "topRated", label: dict.results.sortTopRatedHotels },
          ]}
          sort={hotelSort}
          onSort={(k) => setHotelSort(k as HotelSort)}
        >
          {hotelOptions.map((option) => (
            <OptionRow
              key={option.id}
              selected={option.id === hotel.id}
              cheapest={option.id === cheapestHotels[0]?.id}
              onSelect={() => {
                setHotelId(option.id);
                setPicker(null);
              }}
              media={<HotelThumb photoUrl={option.photoUrl} stars={option.stars} className="h-20 w-24" />}
              heading={<HotelHeading hotel={option} dict={dict} />}
              body={
                <>
                  <p className="mt-1 text-sm text-gray-500">
                    <span dir="ltr">
                      {option.pricePerNight.toLocaleString()} {option.currency}
                    </span>{" "}
                    / {dict.results.perNight} · {nightsLabel(option.nights, dict)}
                  </p>
                  <HotelChips hotel={option} dict={dict} />
                </>
              }
              price={`${option.totalPrice.toLocaleString()} ${option.currency}`}
              priceNote={`${dict.results.totalForStay} · ${nightsLabel(option.nights, dict)}`}
              diff={option.totalPrice - hotel.totalPrice}
              currency={option.currency}
              dict={dict}
            />
          ))}
        </OptionList>
      )}

      {/* ---- The phone's booking bar ----------------------------------
          On a phone the trip card scrolls away long before the traveller has
          finished reading the alternatives, taking the only way to book with
          it. This keeps the total and one button in reach the whole time.
          Hidden on desktop, where the card is never far from the eye, and
          hidden while a picker is open so it cannot sit on top of the list
          the traveller is choosing from. */}
      {primaryHandoff && !picker && (
        <div className="sit-on-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-navy-950/10 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(6,38,83,0.35)] backdrop-blur-md sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p dir="ltr" className="text-base font-extrabold leading-none text-navy-900">
                {total.toLocaleString()} {currency}
              </p>
              <p className="mt-1 truncate text-2xs text-gray-500">
                {travelersText}
                {hotel ? ` · ${nightsLabel(hotel.nights, dict)}` : ""}
              </p>
            </div>
            <a
              href={primaryHandoff.url}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="ms-auto shrink-0 rounded-xl bg-sun-400 px-5 py-3 text-sm font-bold text-navy-950 shadow-[var(--shadow-sun)]"
            >
              {hotelHandoff && flightHandoff
                ? dict.results.bookNow
                : hotelHandoff
                  ? dict.results.bookHotel
                  : dict.results.bookFlight}
            </a>
          </div>
        </div>
      )}
      {/* Clearance so the bar never covers the last row of content. */}
      {(flightHandoff || hotelHandoff) && <div className="h-20 sm:hidden" aria-hidden="true" />}
    </div>
  );
}

/**
 * The button that leaves the site.
 *
 * Orange, because it is the one action on the page that completes the job,
 * and the palette reserves orange for exactly that. `rel` carries `sponsored`
 * as well as `nofollow`: these are commercial links and saying so is both
 * Google's requirement and the honest thing.
 */
function BookingButton({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <div className="flex-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sun-400 px-5 py-3.5 text-sm font-bold text-navy-950 shadow-[var(--shadow-sun)] transition hover:-translate-y-0.5 hover:bg-sun-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-2"
      >
        {label}
        <span aria-hidden="true">↗</span>
      </a>
      <p className="mt-1.5 text-center text-2xs leading-relaxed text-gray-500">{note}</p>
    </div>
  );
}

function ChangeButton({
  label,
  count,
  open,
  onClick,
}: {
  label: string;
  count: string | null;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        className={`rounded-xl px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
          open ? "bg-brand-900 text-white" : "border border-brand-200 text-brand-800 hover:bg-brand-50"
        }`}
      >
        {label}
      </button>
      {count && <span className="text-[11px] text-gray-400">{count}</span>}
    </>
  );
}

/**
 * The alternatives, as a dialog over the page.
 *
 * Swapping a flight is a comparison, and a comparison wants the screen to
 * itself: inline, the list pushed the trip card up and the traveller lost
 * sight of the thing they were comparing against. As an overlay the trip
 * stays put underneath, the list gets the full height, and picking an option
 * closes it and returns them exactly where they were.
 *
 * It behaves the way a dialog is expected to — Escape closes it, so does a
 * click on the backdrop, the page behind it stops scrolling while it is open,
 * and focus moves into it so a keyboard lands inside the list rather than
 * somewhere back up the page.
 */
function OptionList({
  title,
  note,
  onClose,
  closeLabel,
  sortOptions,
  sort,
  onSort,
  children,
}: {
  title: string;
  note: string;
  onClose: () => void;
  closeLabel: string;
  sortOptions: { key: string; label: string }[];
  sort: string;
  onSort: (key: string) => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  // `onClose` is stable (see the useCallback in TripBuilder), so this runs
  // once on open rather than on every render — which matters, because a
  // re-run would yank focus back to the panel each time the sort changed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Stop the page behind scrolling with the dialog's own list.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        // Anywhere outside the panel — which includes the backdrop element
        // covering the container, so comparing against currentTarget alone
        // would never match.
        if (!panelRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div className="absolute inset-0 bg-navy-990/70 backdrop-blur-sm" aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:max-h-[85vh] sm:rounded-2xl"
      >
        {/* Header stays put while the list scrolls under it. */}
        <div className="shrink-0 border-b border-gray-100 px-5 pb-4 pt-5 sm:px-6">
          {/* Grab handle — the affordance a sheet has on a phone. */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={headingId} className="text-lg font-extrabold text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{note}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="-me-1 shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSort(opt.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  sort === opt.key
                    ? "bg-brand-900 text-white"
                    : "border border-gray-200 text-gray-600 hover:border-brand-200 hover:text-brand-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {children}
        </ul>
      </div>
    </div>
  );
}

function OptionRow({
  selected,
  cheapest,
  onSelect,
  media,
  heading,
  body,
  price,
  priceNote,
  diff,
  currency,
  dict,
}: {
  selected: boolean;
  cheapest: boolean;
  onSelect: () => void;
  media: React.ReactNode;
  heading: React.ReactNode;
  body: React.ReactNode;
  price: string;
  priceNote: string;
  diff: number;
  currency: string;
  dict: Dict;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={selected}
        className={`flex w-full gap-3 rounded-xl border p-3.5 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
          selected
            ? "cursor-default border-brand-300 bg-brand-50/70"
            : "border-gray-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
        }`}
      >
        {media}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              {heading}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {selected && (
                  <span className="rounded-full bg-brand-900 px-2 py-0.5 text-[11px] font-bold text-white">
                    {dict.results.currentChoice}
                  </span>
                )}
                {cheapest && !selected && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                    {dict.results.cheapestOption}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <DeltaChip diff={diff} currency={currency} sameLabel={dict.results.samePrice} />
              <span dir="ltr" className="text-sm font-extrabold text-gray-900">
                {price}
              </span>
              <span className="text-[11px] text-gray-500">{priceNote}</span>
            </div>
          </div>

          {body}
        </div>
      </button>
    </li>
  );
}
