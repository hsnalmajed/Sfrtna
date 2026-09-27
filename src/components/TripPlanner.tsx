"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DestinationCategory, FlightRoute, Locale, TravelerCounts } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import TravelersPicker from "@/components/TravelersPicker";
import AirportInput from "@/components/AirportInput";
import { currencyForOrigin } from "@/components/CurrencySelect";
import DateRangeInput from "@/components/DateRangeInput";
import Icon, { type IconName } from "@/components/ui/Icon";
import { parseChildrenAges, serializeChildrenAges } from "@/lib/searchParamsUtil";
import { focusFirstError, hasErrors, type FieldErrors } from "@/lib/formErrors";
import { formStyles, type FormTone } from "@/lib/formTone";
import { BudgetInput, EdgeTabs, FieldLabel, Toggle, nightsBetween, toDigits } from "@/components/PlannerFields";

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

interface LegDraft {
  destination: string;
  nights: number;
}

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
  const [destination, setDestination] = useState(sp.get("destination") || "");
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
  const [legs, setLegs] = useState<LegDraft[]>(() => {
    const raw = sp.get("legs");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
      } catch {
        // fall through to defaults
      }
    }
    return [
      { destination: "", nights: 3 },
      { destination: "", nights: 4 },
    ];
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  // The optional row is always open on a wide screen, where it costs one
  // line; on a phone it folds away behind its heading.
  const [extrasOpen, setExtrasOpen] = useState(false);

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

  function updateLeg(index: number, patch: Partial<LegDraft>) {
    setLegs((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLeg() {
    setLegs((prev) => [...prev, { destination: "", nights: 2 }]);
  }
  function removeLeg(index: number) {
    setLegs((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
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
    if (showDestination && !destination.trim()) next.destination = dict.form.errorDestination;
    if (listsLegs && legs.filter((l) => l.destination.trim()).length < 2) {
      next.legs = dict.form.errorLegs;
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
      const validLegs = legs.filter((l) => l.destination.trim().length > 0);
      const params = new URLSearchParams({ ...shared, legs: JSON.stringify(validLegs) });
      router.push(`/${locale}/multicity-results?${params.toString()}`);
      return;
    }

    if (mode === "discover") {
      const params = new URLSearchParams({
        ...shared,
        mode: "discover",
        returnDate: showReturnDate ? returnDate : "",
        multiDestination: String(tripRoute === "multicity"),
        oneWayOnly: String(isOneWay),
        preferenceCategory,
      });
      router.push(`/${locale}/discover-results?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({
      ...shared,
      mode: "known",
      destination,
      returnDate: showReturnDate ? returnDate : "",
    });
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

      {/* What the chosen route means, said once under the switch — centred
          with it and bright enough to be read, not a faint line off to the
          side that nobody notices. */}
      {((mode === "discover" && tripRoute === "multicity") || isOneWay) && (
        <p
          className={`mx-auto mt-1 flex w-fit max-w-full items-center gap-2 rounded-full px-3.5 py-1.5 text-center text-xs font-semibold sm:text-sm ${
            dark ? "bg-sun-400/10 text-sun-200 ring-1 ring-sun-400/30" : "bg-sun-50 text-navy-800 ring-1 ring-sun-200"
          }`}
        >
          <span aria-hidden="true">ℹ️</span>
          {isOneWay ? dict.discoverForm.oneWayHint : dict.discoverForm.multiDestinationHint}
        </p>
      )}

      {/* ── 3. The row that is the search ─────────────────────────────
          Auto-fit, so the known tab's five fields and the suggest tab's
          four both fill the width with no empty column. */}
      <div className="mt-5 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
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
                direction. Sits on the seam between the two fields. */}
            {showDestination && (
              <button
                type="button"
                onClick={swapPlaces}
                aria-label={dict.form.swapPlaces}
                title={dict.form.swapPlaces}
                className={`absolute -end-[1.15rem] top-[2.15rem] z-10 hidden h-8 w-8 items-center justify-center rounded-full ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 lg:flex ${
                  dark
                    ? "bg-navy-990 text-white/85 ring-white/25 hover:text-sun-400 hover:ring-sun-400"
                    : "bg-white text-navy-700 ring-mist-300 hover:ring-navy-400"
                }`}
              >
                <Icon name="swap" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

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
            error={errors.departDate || errors.returnDate}
            onChange={({ departDate: d, returnDate: r }) => {
              setDepartDate(d);
              setReturnDate(r);
              setErrors((prev) => ({ ...prev, departDate: "", returnDate: "" }));
            }}
          />
        </div>

        <div>
          <FieldLabel dark={dark} icon="users">{dict.travelers.label}</FieldLabel>
          <TravelersPicker locale={locale} value={travelers} onChange={setTravelers} tone={tone} />
        </div>

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

      {/* ── The cities, when the traveller is listing them ───────────── */}
      {listsLegs && (
        <div className={`mt-5 border-t pt-5 ${divider}`} data-field="legs">
          <div className="mb-3 flex items-center justify-between">
            <p className={sectionTitle}>{dict.multicity.title}</p>
            <button type="button" onClick={addLeg} className={st.ghostButton}>
              + {dict.multicity.addLeg}
            </button>
          </div>

          <div className="space-y-3">
            {legs.map((leg, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-xl border p-3 ${divider}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sun-400 text-xs font-bold text-navy-950">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <AirportInput
                    locale={locale}
                    value={leg.destination}
                    onChange={(v) => updateLeg(i, { destination: v })}
                    placeholder={dict.multicity.legDestination}
                    className={inputClass}
                    ariaLabel={dict.multicity.legDestination}
                    required
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className={inputClass + " w-24 shrink-0"}
                  value={leg.nights}
                  onChange={(e) => updateLeg(i, { nights: Number(e.target.value) })}
                  title={dict.multicity.legNights}
                  aria-label={dict.multicity.legNights}
                />
                <button
                  type="button"
                  onClick={() => removeLeg(i)}
                  disabled={legs.length <= 2}
                  className={`shrink-0 rounded-lg px-2 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                    dark ? "text-rose-300 hover:bg-white/10" : "text-red-500 hover:bg-red-50"
                  }`}
                >
                  {dict.multicity.removeLeg}
                </button>
              </div>
            ))}
          </div>
          {errors.legs && (
            <p role="alert" className={errorClass}>
              {errors.legs}
            </p>
          )}
        </div>
      )}

      {/* ── 4. Optional, and saying so ─────────────────────────────────
          Folded behind its heading on every screen: the search button stays
          close to the fields that matter, and whoever wants more opens it. */}
      <div className={`mt-5 border-t pt-4 ${divider}`}>
        <button
          type="button"
          onClick={() => setExtrasOpen((v) => !v)}
          aria-expanded={extrasOpen}
          className="flex w-full items-center justify-between gap-3 text-start"
        >
          <span className={sectionTitle}>
            {dict.form.extrasTitle}{" "}
            <span className={`font-normal ${dark ? "text-white/50" : "text-navy-500"}`}>
              {dict.form.extrasOptional}
            </span>
          </span>
          <Icon
            name="chevron"
            className={`h-4 w-4 transition ${extrasOpen ? "rotate-180" : ""} ${dark ? "text-white/60" : "text-navy-500"}`}
          />
        </button>

        <div className={`${extrasOpen ? "flex" : "hidden"} mt-3 flex-col gap-4`}>
          {/* The one question only the suggest tab asks. */}
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

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Toggle dark={dark} id="plan-direct" checked={directOnly} onChange={setDirectOnly} icon="takeoff">
              {dict.form.directShort}
            </Toggle>
            <Toggle dark={dark} id="plan-bags" checked={baggageIncluded} onChange={setBaggageIncluded} icon="luggage">
              {dict.form.baggageShort}
            </Toggle>
          </div>
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
