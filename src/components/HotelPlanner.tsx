"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale, TravelerCounts } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import TravelersPicker from "@/components/TravelersPicker";
import DateRangeInput from "@/components/DateRangeInput";
import Icon from "@/components/ui/Icon";
import HotelNameInput from "@/components/HotelNameInput";
import { MAX_GUESTS_PER_ROOM, occupancy, roomFitsParty, type StayType } from "@/lib/stayType";
import { parseChildrenAges, serializeChildrenAges } from "@/lib/searchParamsUtil";
import { focusFirstError, hasErrors, type FieldErrors } from "@/lib/formErrors";
import { formStyles, type FormTone } from "@/lib/formTone";
import { BudgetInput, EdgeTabs, FieldLabel, Toggle } from "@/components/PlannerFields";

/**
 * The hotel planner.
 *
 * Two questions, like the flight planner, because a hotel search starts the
 * same two ways:
 *
 *   known     — "I already know the hotel": its name, the nights, the party.
 *               Nothing else matters; the traveller has chosen.
 *   discover  — "suggest one": the city, the nights, the party, the money,
 *               and optionally the stars, room or apartment, and breakfast.
 *
 * Both submit to /hotel-results. What that page can honestly show today is
 * the search, carried to a partner intact — see the page for why there are
 * no prices on it yet. The form is built for the day there are: the budget,
 * the stars and the breakfast are the questions a real comparison will need,
 * so they are asked now rather than bolted on later.
 *
 * The hotel's name offers Google's hotel names as the traveller types (see
 * HotelNameInput); a picked name carries where the hotel is, so the price
 * search finds the right one of several Holiday Inns. Free text still works.
 */

type HotelMode = "known" | "discover";

export default function HotelPlanner({
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
  tone?: FormTone;
}) {
  const dict = getDictionary(locale);
  const router = useRouter();
  const urlParams = useSearchParams();
  // Only initial values are read from here, so which source wins is fixed
  // for the life of the form.
  const sp = preset !== undefined ? new URLSearchParams(preset) : urlParams;
  const dark = tone === "dark";

  // Arriving with a city and no hotel (from a city's "Book your trip") means
  // hotels in that city: the discover search, with the city filled in.
  const [mode, setMode] = useState<HotelMode>(
    sp.get("hmode") === "discover" || (!sp.get("hmode") && sp.get("city") && !sp.get("hotel")) ? "discover" : "known"
  );
  const [hotel, setHotel] = useState(sp.get("hotel") || "");
  // Where the picked hotel is, from the suggestion list; cleared on typing.
  const [hotelArea, setHotelArea] = useState(sp.get("hotelArea") || "");
  const [city, setCity] = useState(sp.get("city") || "");
  const [checkIn, setCheckIn] = useState(sp.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(sp.get("checkOut") || "");
  const [travelers, setTravelers] = useState<TravelerCounts>({
    adults: Number(sp.get("adults")) || 2,
    childrenAges: parseChildrenAges(sp.get("childrenAges")),
    infants: Number(sp.get("infants")) || 0,
  });
  const [budget, setBudget] = useState(sp.get("budget") || "");
  const [currency, setCurrency] = useState(sp.get("currency") || "SAR");
  const [minStars, setMinStars] = useState(Number(sp.get("minStars")) || 0);
  const [stayType, setStayType] = useState<StayType | "">(() => {
    const s = sp.get("stay");
    return s === "room" || s === "apartment" ? s : "";
  });
  const [breakfast, setBreakfast] = useState(sp.get("breakfast") === "true");
  const [errors, setErrors] = useState<FieldErrors>({});

  const guests = occupancy(travelers);
  const roomPossible = roomFitsParty(guests);
  const effectiveStayType: StayType | "" = stayType === "room" && !roomPossible ? "apartment" : stayType;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (mode === "known" && !hotel.trim()) next.hotel = dict.hotelForm.errorHotelName;
    if (mode === "discover" && !city.trim()) next.city = dict.hotelForm.errorCity;
    if (!checkIn) next.departDate = dict.hotelForm.errorCheckIn;
    if (!checkOut) next.returnDate = dict.hotelForm.errorCheckOut;
    if (mode === "discover") {
      if (!budget) next.budget = dict.form.errorBudget;
      else if (Number(budget) <= 0) next.budget = dict.form.errorBudgetPositive;
    }
    return next;
  }

  const FIELD_ORDER = ["hotel", "city", "departDate", "returnDate", "budget"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstError(found, FIELD_ORDER);
      return;
    }

    const params = new URLSearchParams({
      hmode: mode,
      checkIn,
      checkOut,
      adults: String(travelers.adults),
      childrenAges: serializeChildrenAges(travelers.childrenAges),
      infants: String(travelers.infants),
    });
    if (mode === "known") {
      params.set("hotel", hotel.trim());
      if (hotelArea) params.set("hotelArea", hotelArea);
    } else {
      params.set("city", city.trim());
      params.set("budget", String(Number(budget)));
      params.set("currency", currency);
      if (minStars) params.set("minStars", String(minStars));
      if (effectiveStayType) params.set("stay", effectiveStayType);
      if (breakfast) params.set("breakfast", "true");
    }
    router.push(`/${locale}/hotel-results?${params.toString()}`);
  }

  const st = formStyles(tone);
  const inputClass = st.input;
  const errorClass = `mt-1.5 text-xs font-semibold ${dark ? "text-rose-300" : "text-red-600"}`;
  const sectionTitle = `text-sm font-bold ${dark ? "text-white/90" : "text-navy-900"}`;
  const muted = `text-xs ${dark ? "text-white/55" : "text-navy-500"}`;
  const divider = dark ? "border-white/10" : "border-mist-200";

  return (
    <form noValidate onSubmit={handleSubmit} className={st.surface}>
      <EdgeTabs<HotelMode>
        dark={dark}
        label={dict.productSelect.hotelsTitle}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setErrors({});
        }}
        tabs={[
          { value: "known", icon: "hotel", title: dict.hotelForm.knownTitle, hint: dict.hotelForm.knownHint },
          { value: "discover", icon: "compass", title: dict.hotelForm.discoverTitle, hint: dict.hotelForm.discoverHint },
        ]}
      />

      <div className="mt-5 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
        {mode === "known" ? (
          <div data-field="hotel">
            <FieldLabel dark={dark} icon="hotel" htmlFor="hotel-name">
              {dict.hotelForm.hotelName}
            </FieldLabel>
            <HotelNameInput
              id="hotel-name"
              className={inputClass}
              value={hotel}
              placeholder={dict.hotelForm.hotelNamePlaceholder}
              invalid={Boolean(errors.hotel)}
              onChange={(name) => {
                setHotel(name);
                setHotelArea("");
                setErrors((prev) => ({ ...prev, hotel: "" }));
              }}
              onPick={(s) => {
                setHotel(s.name);
                setHotelArea(s.area);
                setErrors((prev) => ({ ...prev, hotel: "" }));
              }}
            />
            {errors.hotel && (
              <p role="alert" className={errorClass}>
                {errors.hotel}
              </p>
            )}
          </div>
        ) : (
          <div data-field="city">
            <FieldLabel dark={dark} icon="pin" htmlFor="hotel-city">
              {dict.hotelForm.city}
            </FieldLabel>
            <input
              id="hotel-city"
              type="text"
              autoComplete="off"
              className={inputClass}
              value={city}
              placeholder={dict.hotelForm.cityPlaceholder}
              aria-invalid={Boolean(errors.city)}
              onChange={(e) => {
                setCity(e.target.value);
                setErrors((prev) => ({ ...prev, city: "" }));
              }}
            />
            {errors.city && (
              <p role="alert" className={errorClass}>
                {errors.city}
              </p>
            )}
          </div>
        )}

        <div data-field="departDate">
          <FieldLabel dark={dark} icon="calendar">
            {dict.hotelForm.dates}
          </FieldLabel>
          <DateRangeInput
            locale={locale}
            departDate={checkIn}
            returnDate={checkOut}
            withReturn
            required
            tone={tone}
            error={errors.departDate || errors.returnDate}
            onChange={({ departDate: d, returnDate: r }) => {
              setCheckIn(d);
              setCheckOut(r);
              setErrors((prev) => ({ ...prev, departDate: "", returnDate: "" }));
            }}
          />
        </div>

        <div>
          <FieldLabel dark={dark} icon="users">{dict.travelers.label}</FieldLabel>
          <TravelersPicker locale={locale} value={travelers} onChange={setTravelers} tone={tone} />
        </div>

        {mode === "discover" && (
          <BudgetInput
            id="hotel-budget"
            locale={locale}
            dark={dark}
            label={dict.hotelForm.budget}
            placeholder={dict.hotelForm.budgetPlaceholder}
            currencyLabel={dict.form.currency}
            value={budget}
            onChange={(v) => {
              setBudget(v);
              setErrors((prev) => ({ ...prev, budget: "" }));
            }}
            currency={currency}
            onCurrencyChange={setCurrency}
            error={errors.budget}
          />
        )}
      </div>

      {/* The hotel's own preferences — only when we are the ones choosing. */}
      {mode === "discover" && (
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
            <div className="grid grid-cols-1 items-end gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,11rem)_minmax(0,11rem)_1fr]">
              <div>
                <FieldLabel dark={dark} icon="star" htmlFor="hotel-stars">
                  {dict.form.minStars}
                </FieldLabel>
                <select
                  id="hotel-stars"
                  className={inputClass}
                  value={minStars}
                  onChange={(e) => setMinStars(Number(e.target.value))}
                >
                  <option value={0}>{dict.form.anyStars}</option>
                  {[2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {"★".repeat(s)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel dark={dark} icon="bed" htmlFor="hotel-stay">
                  {dict.stayType.label}
                </FieldLabel>
                <select
                  id="hotel-stay"
                  className={inputClass}
                  value={effectiveStayType}
                  onChange={(e) => setStayType(e.target.value as StayType | "")}
                >
                  <option value="">{dict.stayType.any}</option>
                  <option value="room" disabled={!roomPossible}>
                    {dict.stayType.room}
                  </option>
                  <option value="apartment">{dict.stayType.apartment}</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 sm:col-span-2 lg:col-span-1 lg:justify-end lg:pb-2.5">
                <Toggle dark={dark} id="hotel-breakfast" checked={breakfast} onChange={setBreakfast} icon="coffee">
                  {dict.form.breakfastShort}
                </Toggle>
              </div>
            </div>

            {!roomPossible && (
              <p className={muted}>
                {dict.stayType.apartmentOnlyHint.replace("{count}", String(guests))}{" "}
                <span className="opacity-70">
                  ({dict.stayType.roomFitsHint.replace("{max}", String(MAX_GUESTS_PER_ROOM))})
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        className={`mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-base font-extrabold transition hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          dark
            ? "bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300 focus-visible:ring-sun-400 focus-visible:ring-offset-navy-990"
            : "bg-navy-900 text-white shadow-lg hover:bg-navy-800 focus-visible:ring-navy-400"
        }`}
      >
        <Icon name="search" className="h-5 w-5" strokeWidth={2.4} />
        {mode === "known" ? dict.hotelForm.submitKnown : dict.hotelForm.submitDiscover}
      </button>

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
