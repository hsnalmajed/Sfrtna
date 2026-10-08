"use client";

import { useEffect, useState } from "react";
import { warmFlightSearch } from "@/components/FlightMetasearch";
import { useRouter, useSearchParams } from "next/navigation";
import type { DestinationCategory, FlightRoute, Locale, TravelerCounts } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import TravelersPicker from "@/components/TravelersPicker";
import AirportInput from "@/components/AirportInput";
import { currencyForOrigin } from "@/components/CurrencySelect";
import DateRangeInput from "@/components/DateRangeInput";
import Icon, { type IconName } from "@/components/ui/Icon";
import { parseChildrenAges, serializeChildrenAges } from "@/lib/searchParamsUtil";
import { strictIata } from "@/lib/flights";
import { CONTINENTS, type Continent } from "@/lib/countries";
import { focusFirstError, hasErrors, type FieldErrors } from "@/lib/formErrors";
import { formStyles, type FormTone } from "@/lib/formTone";
import { BudgetInput, EdgeTabs, FieldLabel, Toggle, nightsBetween, toDigits } from "@/components/PlannerFields";
import { useDefaultOrigin } from "@/lib/useOrigin";
import { trackSearchUrl } from "@/lib/analytics";

/**
 * The flight planner, laid out the way a traveller thinks.
 *
 * Flights only. It used to be one form for flights, hotels or both, with a
 * three-way switch and hotel questions (stars, room or apartment, breakfast)
 * hanging off it. Those were two different searches sharing a box: a flight
 * budget and a hotel budget are different numbers, and a hotel question on
 * a flight search is noise. Hotels have their own planner now (HotelPlanner),
 * chosen one step earlier on the homepage.
 *
 * The order on screen is the order of the questions in someone's head:
 *
 *   1. Do I know where I'm going?          the two tabs on the panel's edge
 *   2. Round trip, one way, several cities
 *   3. From where, to where, when, who,    one row, read in one glance
 *      and for how much?
 *   4. Anything particular?                optional, and labelled as optional
 *   5. Go.
 *
 * Both tabs drive one form with one set of state, so switching from "I know
 * where" to "suggest somewhere" keeps everything already typed — checking
 * whether the same money buys a better trip elsewhere costs one click.
 *
 * The three destinations this can submit to:
 *   known + multi-city  → /multicity-results  (the legs the traveller listed)
 *   known               → /results
 *   suggest             → /discover-results
 */

type Mode = "known" | "discover";

/**
 * One flight of a multi-city trip, the way every flight search asks for it:
 * from, to, and the day. `autoOrigin` is true while the "from" is still the
 * one we filled in from the flight before — typing over it hands it back to
 * the traveller, and we stop following.
 */
interface LegDraft {
  origin: string;
  destination: string;
  date: string;
  autoOrigin: boolean;
}

/** Five flights, like Google Flights: enough for any real trip. */
const MAX_LEGS = 5;

const CATEGORY_OPTIONS: DestinationCategory[] = [
  "beach",
  "nature",
  "adventure",
  "city",
  "culture",
  "family",
];

export default function TripPlanner({
  locale,
  tone = "light",
  preset,
}: {
  locale: Locale;
  /**
   * A starting trip handed over by the page (a query string), read instead
   * of the URL's — the season tab's "book your trip to <city>" uses it to
   * open the form with that city already filled in.
   */
  preset?: string;
  /** "dark" when the form sits on the hero photograph — see formTone.ts. */
  tone?: FormTone;
}) {
  // The results page runs the partner's flight search; fetch its script
  // and open its connections while this form is being filled in.
  useEffect(() => {
    warmFlightSearch();
  }, []);
  const dict = getDictionary(locale);
  const router = useRouter();
  const urlParams = useSearchParams();
  // Only initial values are read from here, so which source wins is fixed
  // for the life of the form.
  const sp = preset !== undefined ? new URLSearchParams(preset) : urlParams;
  const dark = tone === "dark";

  // Arriving from a results page's "edit search" carries every answer back,
  // including which tab it came from.
  const [mode, setMode] = useState<Mode>(sp.get("mode") === "discover" ? "discover" : "known");

  const [tripRoute, setTripRoute] = useState<FlightRoute>(
    (sp.get("tripRoute") as FlightRoute) || "roundtrip"
  );
  const [origin, setOrigin] = useState(sp.get("origin") || "");
  useDefaultOrigin(origin, setOrigin);
  const [destination, setDestination] = useState(sp.get("destination") || "");
  // Suggest + several countries: how many countries the route visits.
  const [stopCount, setStopCount] = useState<2 | 3>(sp.get("stops") === "3" ? 3 : 2);
  // Continents to suggest from; none chosen = no preference.
  const [continents, setContinents] = useState<Continent[]>(() =>
    (sp.get("continents") ?? "").split(",").filter((c): c is Continent => CONTINENTS.includes(c as Continent))
  );
  const [preferenceCategory, setPreferenceCategory] = useState<DestinationCategory | "">(
    (sp.get("preferenceCategory") as DestinationCategory) || ""
  );
  const [departDate, setDepartDate] = useState(sp.get("departDate") || "");
  const [returnDate, setReturnDate] = useState(sp.get("returnDate") || "");
  const [travelers, setTravelers] = useState<TravelerCounts>({
    adults: Number(sp.get("adults")) || 2,
    childrenAges: parseChildrenAges(sp.get("childrenAges")),
    infants: Number(sp.get("infants")) || 0,
  });
  const [budget, setBudget] = useState(toDigits(sp.get("budget") || ""));
  const [currency, setCurrency] = useState(sp.get("currency") || "SAR");
  const [directOnly, setDirectOnly] = useState(sp.get("directOnly") === "true");
  const [baggageIncluded, setBaggageIncluded] = useState(sp.get("baggageIncluded") === "true");
  // Flights after the first. The first flight's "from" and date are the
  // form's own origin and departure date, so the rest of the planner (the
  // currency that follows the departure city, the edit-search round trip)
  // keeps working unchanged.
  const [legs, setLegs] = useState<LegDraft[]>(() => {
    const raw = sp.get("legs");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed.map((l: Partial<LegDraft>) => ({
            origin: String(l.origin ?? ""),
            destination: String(l.destination ?? ""),
            date: String(l.date ?? ""),
            autoOrigin: false,
          }));
        }
      } catch {
        // fall through to defaults
      }
    }
    return [
      { origin: "", destination: "", date: "", autoOrigin: true },
      { origin: "", destination: "", date: "", autoOrigin: true },
    ];
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  // The optional row is always open on a wide screen, where it costs one
  // line; on a phone it folds away behind its heading.

  /**
   * The currency follows the departure city until the traveller says
   * otherwise — someone flying out of Kuwait City shouldn't have to convert
   * their own budget before they can type it.
   */
  const [currencyTouched, setCurrencyTouched] = useState(Boolean(sp.get("currency")));
  const originCurrency = currencyForOrigin(origin);
  const effectiveCurrency = !currencyTouched && originCurrency ? originCurrency : currency;


  // "Multi-city" reads two honest ways on the two tabs: a list of cities the
  // traveller names, or a pair of destinations for us to suggest.
  const listsLegs = mode === "known" && tripRoute === "multicity";
  const isOneWay = tripRoute === "oneway";
  const showReturnDate = !isOneWay && !listsLegs;
  const showDestination = mode === "known" && !listsLegs;

  /**
   * Changing where a flight lands also moves where the next one leaves from,
   * as long as the traveller hasn't typed their own — that is how Google
   * Flights and the rest behave, and it saves retyping every city twice.
   */
  function updateLeg(index: number, patch: Partial<LegDraft>) {
    setLegs((prev) =>
      prev.map((l, i) => {
        if (i === index) return { ...l, ...patch };
        if (i === index + 1 && patch.destination !== undefined && l.autoOrigin) {
          return { ...l, origin: patch.destination };
        }
        return l;
      })
    );
    setErrors((prev) => ({ ...prev, legs: "" }));
  }
  function addLeg() {
    setLegs((prev) =>
      prev.length >= MAX_LEGS
        ? prev
        : [...prev, { origin: prev[prev.length - 1]?.destination ?? "", destination: "", date: "", autoOrigin: true }]
    );
  }
  function removeLeg(index: number) {
    setLegs((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== index);
      // The flight that now follows the gap leaves from where the one before
      // it landed, unless its "from" was the traveller's own.
      return next.map((l, i) =>
        i === index && i > 0 && l.autoOrigin ? { ...l, origin: next[i - 1].destination } : l
      );
    });
  }
  function swapPlaces() {
    setOrigin(destination);
    setDestination(origin);
    setErrors((prev) => ({ ...prev, origin: "", destination: "" }));
  }

  /** Every gap at once, rather than one per submit. */
  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!origin.trim()) next.origin = dict.form.errorOrigin;
    else if (!strictIata(origin)) next.origin = dict.form.errorPlaceUnknown;
    if (showDestination && !destination.trim()) next.destination = dict.form.errorDestination;
    else if (showDestination && !strictIata(destination)) next.destination = dict.form.errorPlaceUnknown;
    else if (showDestination && strictIata(destination) === strictIata(origin)) next.destination = dict.form.errorSamePlace;
    if (listsLegs) {
      // The first flight's from/date are the form's origin and departDate.
      const flights = legs.map((l, i) =>
        i === 0 ? { ...l, origin, date: departDate } : l
      );
      if (flights.some((l) => !strictIata(l.origin) || !strictIata(l.destination) || !l.date)) {
        next.legs = dict.multicity.errorLegIncomplete;
      } else if (flights.some((l, i) => i > 0 && l.date < flights[i - 1].date)) {
        next.legs = dict.multicity.errorLegOrder;
      }
    }
    if (!departDate) next.departDate = dict.form.errorDepartDate;
    if (showReturnDate && !returnDate) next.returnDate = dict.form.errorReturnDate;
    if (!budget) next.budget = dict.form.errorBudget;
    else if (Number(budget) <= 0) next.budget = dict.form.errorBudgetPositive;
    return next;
  }

  const FIELD_ORDER = ["origin", "destination", "legs", "departDate", "returnDate", "budget"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const found = validate();
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError(found, FIELD_ORDER);
      return;
    }

    // The trip's length still travels: the discover and multi-city pages use
    // it to size the stay they plan around the flights. A one-way trip has no
    // return to measure against, so it goes as the discover default.
    const stayNights = showReturnDate ? nightsBetween(departDate, returnDate) : 5;

    // Every answer that is the same on both tabs, in one place — so the
    // three destinations below cannot drift apart.
    const shared: Record<string, string> = {
      tripType: "flight",
      tripRoute,
      origin,
      departDate,
      adults: String(travelers.adults),
      childrenAges: serializeChildrenAges(travelers.childrenAges),
      infants: String(travelers.infants),
      budget: String(Number(budget)),
      currency: effectiveCurrency,
      directOnly: String(directOnly),
      baggageIncluded: String(baggageIncluded),
      nights: String(stayNights),
    };

    if (listsLegs) {
      const flights = legs.map((l, i) => ({
        origin: i === 0 ? origin : l.origin,
        destination: l.destination,
        date: i === 0 ? departDate : l.date,
      }));
      const params = new URLSearchParams({ ...shared, legs: JSON.stringify(flights) });
      trackSearchUrl(`/${locale}/multicity-results?${params.toString()}`);
      router.push(`/${locale}/multicity-results?${params.toString()}`);
      return;
    }

    if (mode === "discover") {
      const params = new URLSearchParams({
        ...shared,
        mode: "discover",
        returnDate: showReturnDate ? returnDate : "",
        multiDestination: String(tripRoute === "multicity"),
        stops: String(stopCount),
        oneWayOnly: String(isOneWay),
        preferenceCategory,
        continents: continents.join(","),
      });
      trackSearchUrl(`/${locale}/discover-results?${params.toString()}`);
      router.push(`/${locale}/discover-results?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({
      ...shared,
      mode: "known",
      destination,
      returnDate: showReturnDate ? returnDate : "",
    });
    trackSearchUrl(`/${locale}/results?${params.toString()}`);
    router.push(`/${locale}/results?${params.toString()}`);
  }

  // ── Styles ──────────────────────────────────────────────────────────
  // Fields come from formTone.ts so the planner and every other form on the
  // site share one definition of what an input looks like. The pieces below
  // are the planner's own furniture.
  const st = formStyles(tone);
  const inputClass = st.input;
  const errorClass = `mt-1.5 text-xs font-semibold ${dark ? "text-rose-300" : "text-red-600"}`;
  const labelRow = `mb-1.5 flex items-center gap-1.5 text-xs font-bold ${
    dark ? "text-white/70" : "text-navy-700"
  }`;
  const labelIcon = `h-3.5 w-3.5 ${dark ? "text-sun-400" : "text-sun-600"}`;
  const sectionTitle = `text-sm font-bold ${dark ? "text-white/90" : "text-navy-900"}`;
  const muted = `text-xs ${dark ? "text-white/55" : "text-navy-500"}`;
  const divider = dark ? "border-white/10" : "border-mist-200";

  const routes: { value: FlightRoute; label: string; icon: IconName }[] = [
    { value: "roundtrip", label: dict.form.tripRouteRoundtrip, icon: "roundtrip" },
    { value: "oneway", label: dict.form.tripRouteOneway, icon: "oneway" },
    { value: "multicity", label: dict.form.tripRouteMulticity, icon: "route" },
  ];

  return (
    <form
      // Our own validation: a native `required` blocks submit before
      // onSubmit fires, so no message was ever shown.
      noValidate
      onSubmit={handleSubmit}
      className={st.surface}
    >
      {/* ── 1. The first question, on the panel's edge ────────────── */}
      <EdgeTabs<Mode>
        dark={dark}
        label={dict.form.whereToLabel}
        value={mode}
        onChange={setMode}
        tabs={[
          { value: "known", icon: "plane", title: dict.modeSelect.knownTitle, hint: dict.modeSelect.knownHint },
          { value: "discover", icon: "globe", title: dict.modeSelect.discoverTitle, hint: dict.modeSelect.discoverHint },
        ]}
      />

      {/* ── 2. Round trip, one way, several cities ─────────────────── */}
      <div className="mb-2.5 flex flex-col items-center gap-2.5">
        {/* A secondary choice, so a compact switch under the tabs rather
            than a second row of big buttons competing with them. */}
          <div
            role="radiogroup"
            aria-label={dict.form.tripRouteRoundtrip}
            className={`inline-flex rounded-full p-0.5 ring-1 ${dark ? "bg-white/[0.06] ring-white/15" : "bg-mist-50 ring-mist-200"}`}
          >
            {routes.map((r) => {
              const active = tripRoute === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTripRoute(r.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
                    active
                      ? dark
                        ? "bg-white text-navy-950"
                        : "bg-navy-900 text-white"
                      : dark
                        ? "text-white/70 hover:text-white"
                        : "text-navy-600 hover:text-navy-900"
                  }`}
                >
                  <Icon name={r.icon} className="h-3.5 w-3.5" />
                  {r.label}
                </button>
              );
            })}
          </div>
      </div>

      {/* ── 3. The row that is the search ─────────────────────────────
          Auto-fit, so the known tab's five fields and the suggest tab's
          four both fill the width with no empty column. */}
      <div className="mt-4 grid grid-cols-1 gap-x-3 gap-y-3.5 sm:mt-5 sm:grid-cols-2 sm:gap-y-4 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
          {!listsLegs && (
          <div data-field="origin" className="relative">
            <FieldLabel dark={dark} icon="pin">{dict.form.origin}</FieldLabel>
            <AirportInput
              locale={locale}
              value={origin}
              onChange={(v) => {
                setOrigin(v);
                setErrors((prev) => ({ ...prev, origin: "" }));
              }}
              placeholder={dict.form.originPlaceholder}
              className={inputClass}
              ariaLabel={dict.form.origin}
              required
            />
            {errors.origin && (
              <p role="alert" className={errorClass}>
                {errors.origin}
              </p>
            )}

            {/* Swap: the most common edit on a return search is the
                direction. Sits on the seam between the two fields — below
                "from" on a phone, where they are stacked, beside it wider. */}
            {showDestination && (
              <button
                type="button"
                onClick={swapPlaces}
                aria-label={dict.form.swapPlaces}
                title={dict.form.swapPlaces}
                className={`absolute -bottom-[1.4rem] end-4 z-10 flex h-8 w-8 rotate-90 items-center justify-center rounded-full ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 sm:bottom-auto sm:-end-[1.15rem] sm:top-[2.15rem] sm:rotate-0 ${
                  dark
                    ? "bg-navy-990 text-white/85 ring-white/25 hover:text-sun-400 hover:ring-sun-400"
                    : "bg-white text-navy-700 ring-mist-300 hover:ring-navy-400"
                }`}
              >
                <Icon name="swap" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          )}

        {showDestination && (
          <div data-field="destination">
            <FieldLabel dark={dark} icon="pin">{dict.form.destination}</FieldLabel>
            <AirportInput
              locale={locale}
              value={destination}
              onChange={(v) => {
                setDestination(v);
                setErrors((prev) => ({ ...prev, destination: "" }));
              }}
              placeholder={dict.form.destinationPlaceholder}
              className={inputClass}
              ariaLabel={dict.form.destination}
              required
            />
            {errors.destination && (
              <p role="alert" className={errorClass}>
                {errors.destination}
              </p>
            )}
          </div>
        )}

        {/* Before the dates: the fares under each day are for this many seats. */}
        <div>
          <FieldLabel dark={dark} icon="users">{dict.travelers.label}</FieldLabel>
          <TravelersPicker locale={locale} value={travelers} onChange={setTravelers} tone={tone} />
        </div>

        {!listsLegs && (
        <div data-field="departDate">
          <FieldLabel dark={dark} icon="calendar">
            {showReturnDate ? dict.form.dates : dict.form.departDate}
          </FieldLabel>
          <DateRangeInput
            locale={locale}
            departDate={departDate}
            returnDate={returnDate}
            withReturn={showReturnDate}
            required
            tone={tone}
            fareRoute={
              showDestination
                ? { origin, destination, currency: effectiveCurrency, seats: travelers.adults + travelers.childrenAges.length }
                : undefined
            }
            error={errors.departDate || errors.returnDate}
            onChange={({ departDate: d, returnDate: r }) => {
              setDepartDate(d);
              setReturnDate(r);
              setErrors((prev) => ({ ...prev, departDate: "", returnDate: "" }));
            }}
          />
        </div>
        )}

        <BudgetInput
          id="plan-budget"
          locale={locale}
          dark={dark}
          label={dict.form.budgetFlightShort}
          placeholder={dict.form.budgetForAll}
          currencyLabel={dict.form.currency}
          value={budget}
          onChange={(v) => {
            setBudget(v);
            setErrors((prev) => ({ ...prev, budget: "" }));
          }}
          currency={effectiveCurrency}
          onCurrencyChange={(c) => {
            setCurrency(c);
            setCurrencyTouched(true);
          }}
          error={errors.budget}
        />
      </div>

      {/* ── Suggest + several countries: how many ──────────────────── */}
      {mode === "discover" && tripRoute === "multicity" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <p className={`${labelRow} !mb-0`}>
            <Icon name="globe" className={labelIcon} />
            {dict.discoverForm.stopsLabel}
          </p>
          {([2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={stopCount === n}
              onClick={() => setStopCount(n)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
                stopCount === n
                  ? "bg-sun-400 text-navy-950 ring-sun-400"
                  : dark
                    ? "bg-white/[0.05] text-white/80 ring-white/15 hover:bg-white/10"
                    : "bg-white text-navy-700 ring-mist-200 hover:ring-navy-200"
              }`}
            >
              {n === 2 ? dict.discoverForm.stopsTwo : dict.discoverForm.stopsThree}
            </button>
          ))}
        </div>
      )}

      {/* ── The flights, when the traveller is listing them ───────────
          The way every multi-city search asks it (Google Flights, Skyscanner,
          Almosafer): one row per flight — from, to, the day — the next
          "from" filled in from the last "to", up to five flights. The first
          row's "from" and date are the form's own. */}
      {listsLegs && (
        <div className={`mt-5 border-t pt-5 ${divider}`} data-field="legs">
          <p className={`mb-3 ${sectionTitle}`}>{dict.multicity.title}</p>

          <div className="space-y-3">
            {legs.map((leg, i) => {
              const legOrigin = i === 0 ? origin : leg.origin;
              const legDate = i === 0 ? departDate : leg.date;
              return (
                <div key={i} className={`rounded-xl border p-3 sm:p-4 ${divider}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className={`flex items-center gap-2 text-sm font-bold ${dark ? "text-white" : "text-navy-900"}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sun-400 text-xs font-black text-navy-950">
                        {i + 1}
                      </span>
                      {dict.multicity.legFlight.replace("{n}", String(i + 1))}
                    </p>
                    {legs.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeLeg(i)}
                        aria-label={`${dict.multicity.removeLeg} ${i + 1}`}
                        className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                          dark ? "text-rose-300 hover:bg-white/10" : "text-red-600 hover:bg-red-50"
                        }`}
                      >
                        ✕ {dict.multicity.removeLeg}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="min-w-0">
                      <FieldLabel dark={dark} icon="pin">{dict.multicity.legFrom}</FieldLabel>
                      <AirportInput
                        locale={locale}
                        value={legOrigin}
                        onChange={(v) => {
                          if (i === 0) {
                            setOrigin(v);
                            setErrors((prev) => ({ ...prev, origin: "", legs: "" }));
                          } else {
                            updateLeg(i, { origin: v, autoOrigin: false });
                          }
                        }}
                        placeholder={dict.form.originPlaceholder}
                        className={inputClass}
                        ariaLabel={`${dict.multicity.legFrom} ${i + 1}`}
                        required
                      />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel dark={dark} icon="pin">{dict.multicity.legTo}</FieldLabel>
                      <AirportInput
                        locale={locale}
                        value={leg.destination}
                        onChange={(v) => updateLeg(i, { destination: v })}
                        placeholder={dict.form.destinationPlaceholder}
                        className={inputClass}
                        ariaLabel={`${dict.multicity.legTo} ${i + 1}`}
                        required
                      />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel dark={dark} icon="calendar">{dict.multicity.legDate}</FieldLabel>
                      <DateRangeInput
                        locale={locale}
                        departDate={legDate}
                        returnDate=""
                        withReturn={false}
                        required
                        tone={tone}
                        onChange={({ departDate: d }) => {
                          if (i === 0) {
                            setDepartDate(d);
                            setErrors((prev) => ({ ...prev, departDate: "", legs: "" }));
                          } else {
                            updateLeg(i, { date: d });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {legs.length < MAX_LEGS && (
            <button type="button" onClick={addLeg} className={`mt-3 ${st.ghostButton}`}>
              + {dict.multicity.addFlight}
            </button>
          )}
          {errors.legs && (
            <p role="alert" className={errorClass}>
              {errors.legs}
            </p>
          )}
        </div>
      )}

      {/* ── 4. Optional, and saying so ─────────────────────────────────
          Always open: folded away, travellers did not see them, and a
          preference no one sees is one no one sets. */}
      <div className={`mt-5 border-t pt-4 ${divider}`}>
        <p className="flex items-center gap-2">
          <span className={sectionTitle}>
            {dict.form.extrasTitle}{" "}
            <span className={`font-normal ${dark ? "text-white/50" : "text-navy-500"}`}>
              {dict.form.extrasOptional}
            </span>
          </span>
        </p>

        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Toggle dark={dark} id="plan-direct" checked={directOnly} onChange={setDirectOnly} icon="takeoff">
              {dict.form.directShort}
            </Toggle>
            <Toggle dark={dark} id="plan-bags" checked={baggageIncluded} onChange={setBaggageIncluded} icon="luggage">
              {dict.form.baggageShort}
            </Toggle>
          </div>

          {/* Where in the world: any number of continents, or none. */}
          {mode === "discover" && (
            <div>
              <p className={labelRow}>
                <Icon name="globe" className={labelIcon} />
                {dict.discoverForm.continentLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["", ...CONTINENTS] as (Continent | "")[]).map((c) => {
                  const active = c ? continents.includes(c) : continents.length === 0;
                  return (
                    <button
                      key={c || "any"}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setContinents((prev) =>
                          !c ? [] : prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                        )
                      }
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
                        active
                          ? "bg-sun-400 text-navy-950 ring-sun-400"
                          : dark
                            ? "bg-white/[0.05] text-white/80 ring-white/15 hover:bg-white/10"
                            : "bg-white text-navy-700 ring-mist-200 hover:ring-navy-200"
                      }`}
                    >
                      {c ? dict.attractions.continents[c] : dict.categories.any}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* What kind of place — also only the suggest tab asks. */}
          {mode === "discover" && (
            <div>
              <p className={labelRow}>
                <Icon name="compass" className={labelIcon} />
                {dict.categories.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["", ...CATEGORY_OPTIONS] as (DestinationCategory | "")[]).map((c) => {
                  const active = preferenceCategory === c;
                  return (
                    <button
                      key={c || "any"}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPreferenceCategory(c)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
                        active
                          ? "bg-sun-400 text-navy-950 ring-sun-400"
                          : dark
                            ? "bg-white/[0.05] text-white/80 ring-white/15 hover:bg-white/10"
                            : "bg-white text-navy-700 ring-mist-200 hover:ring-navy-200"
                      }`}
                    >
                      {c ? dict.categories[c] : dict.categories.any}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── 5. Go ────────────────────────────────────────────────────── */}
      <button
        type="submit"
        className={`mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-base font-extrabold transition hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          dark
            ? "bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300 focus-visible:ring-sun-400 focus-visible:ring-offset-navy-990"
            : "bg-navy-900 text-white shadow-lg hover:bg-navy-800 focus-visible:ring-navy-400"
        }`}
      >
        <Icon name="search" className="h-5 w-5" strokeWidth={2.4} />
        {mode === "discover"
          ? dict.form.submitDiscover
          : listsLegs
            ? dict.multicity.submit
            : dict.form.submitKnown}
      </button>

      {/* What the traveller is and isn't agreeing to, said where they
          decide. The one worry a comparison site has to answer before the
          first click is "will this take my card" — it won't. */}
      <p className={`mt-3 text-balance text-center ${muted}`}>
        <Icon
          name="shield"
          className={`me-1.5 inline-block h-3.5 w-3.5 -translate-y-px align-middle ${dark ? "text-sun-400" : "text-sun-600"}`}
        />
        {dict.form.trustLine}
      </p>
    </form>
  );
}
