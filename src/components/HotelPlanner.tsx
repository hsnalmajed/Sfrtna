"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale, TravelerCounts } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import TravelersPicker from "@/components/TravelersPicker";
import DateRangeInput from "@/components/DateRangeInput";
import Icon from "@/components/ui/Icon";
import HotelNameInput from "@/components/HotelNameInput";
import HotelCityInput, { findHotelCity } from "@/components/HotelCityInput";
import type { GuessedCity } from "@/lib/providers/localHotels";
import { MAX_GUESTS_PER_ROOM, occupancy, roomFitsParty, type StayType } from "@/lib/stayType";
import { parseChildrenAges, serializeChildrenAges } from "@/lib/searchParamsUtil";
import { focusFirstError, hasErrors, type FieldErrors } from "@/lib/formErrors";
import { formStyles, type FormTone } from "@/lib/formTone";
import { BudgetInput, ChoiceChips, EdgeTabs, FieldLabel, PreferencesPanel, Toggle } from "@/components/PlannerFields";
import { trackSearchUrl } from "@/lib/analytics";

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
  // Only a hotel picked from the list is searched: a typed name, misspelt,
  // finds the wrong hotel or none. A search coming back to be edited was
  // picked the first time.
  const [hotelPicked, setHotelPicked] = useState(Boolean(sp.get("hotel") && sp.get("hotelArea")));
  // The city, likewise, must be one of ours; shown in the traveller's language.
  // The city named in the hotel box («هيلتون جدة»): when no hotel matches,
  // the traveller is offered that city's hotels rather than a dead end.
  const [cityGuess, setCityGuess] = useState<GuessedCity | null>(null);
  const [cityEntry, setCityEntry] = useState(() => findHotelCity(sp.get("city") || ""));
  const [city, setCity] = useState(() => {
    const found = findHotelCity(sp.get("city") || "");
    return found ? (locale === "ar" ? found.nameAr : found.nameEn) : sp.get("city") || "";
  });
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
    if (mode === "known") {
      if (!hotel.trim()) next.hotel = dict.hotelForm.errorHotelName;
      else if (!hotelPicked) next.hotel = dict.hotelForm.errorPickHotel;
    }
    if (mode === "discover") {
      if (!city.trim()) next.city = dict.hotelForm.errorCity;
      else if (!cityEntry) next.city = dict.hotelForm.errorPickCity;
    }
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
      if (cityEntry) {
        params.set("city", cityEntry.nameEn);
        params.set("label", locale === "ar" ? cityEntry.nameAr : cityEntry.nameEn);
      }
      params.set("budget", String(Number(budget)));
      params.set("currency", currency);
      if (minStars) params.set("minStars", String(minStars));
      if (effectiveStayType) params.set("stay", effectiveStayType);
      if (breakfast) params.set("breakfast", "true");
    }
    trackSearchUrl(`/${locale}/hotel-results?${params.toString()}`);
    router.push(`/${locale}/hotel-results?${params.toString()}`);
  }

  const st = formStyles(tone);
  const inputClass = st.input;
  const errorClass = `mt-1.5 text-xs font-semibold ${dark ? "text-rose-300" : "text-red-600"}`;
  const muted = `text-xs ${dark ? "text-white/55" : "text-navy-500"}`;

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
              loadingText={dict.hotelForm.searchingHotels}
              arabic={locale === "ar"}
              onCityGuess={setCityGuess}
              emptyText={
                <span>
                  {dict.hotelForm.noHotelMatch}{" "}
                  <button
                    type="button"
                    className="font-bold text-sea-700 underline underline-offset-2"
                    onClick={() => {
                      const entry = cityGuess ? findHotelCity(cityGuess.nameEn) : undefined;
                      if (entry) {
                        setCity(locale === "ar" ? entry.nameAr : entry.nameEn);
                        setCityEntry(entry);
                      }
                      setMode("discover");
                      setErrors({});
                    }}
                  >
                    {cityGuess
                      ? dict.hotelForm.searchCityHotels.replace(
                          "{city}",
                          locale === "ar" ? cityGuess.nameAr : cityGuess.nameEn
                        )
                      : dict.hotelForm.searchByCity}
                  </button>
                </span>
              }
              onType={(text) => {
                setHotel(text);
                setHotelArea("");
                setHotelPicked(false);
                setErrors((prev) => ({ ...prev, hotel: "" }));
              }}
              onPick={(h) => {
                setHotel(h.name);
                setHotelArea(h.area);
                setHotelPicked(true);
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
            <HotelCityInput
              id="hotel-city"
              locale={locale}
              className={inputClass}
              value={city}
              placeholder={dict.hotelForm.cityPlaceholder}
              invalid={Boolean(errors.city)}
              emptyText={dict.hotelForm.noCityMatch}
              onType={(text) => {
                setCity(text);
                setCityEntry(undefined);
                setErrors((prev) => ({ ...prev, city: "" }));
              }}
              onPick={(c) => {
                setCity(locale === "ar" ? c.nameAr : c.nameEn);
                setCityEntry(c);
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

      {/* The hotel's own preferences — only when we are the ones choosing —
          folded into one card (PreferencesPanel), in the order a traveller
          decides them: breakfast, then the stars, then the kind of stay. */}
      {mode === "discover" && (
        <PreferencesPanel
          dark={dark}
          title={dict.form.extrasTitle}
          hint={dict.form.extrasHint}
          chosen={[
            ...(breakfast ? [dict.form.breakfastShort] : []),
            ...(minStars ? ["★".repeat(minStars)] : []),
            ...(effectiveStayType ? [dict.stayType[effectiveStayType]] : []),
          ]}
        >
          <Toggle dark={dark} id="hotel-breakfast" checked={breakfast} onChange={setBreakfast} icon="coffee">
            {dict.form.breakfastShort}
          </Toggle>

          <div>
            <FieldLabel dark={dark} icon="star">
              {dict.form.minStars}
            </FieldLabel>
            <ChoiceChips<number>
              dark={dark}
              options={[{ value: 0, label: dict.form.anyStars }, ...[2, 3, 4, 5].map((n) => ({ value: n, label: "★".repeat(n) }))]}
              isOn={(v) => v === minStars}
              onPick={setMinStars}
            />
          </div>

          <div>
            <FieldLabel dark={dark} icon="bed">
              {dict.stayType.label}
            </FieldLabel>
            <ChoiceChips<StayType | "">
              dark={dark}
              options={[
                { value: "", label: dict.stayType.any },
                { value: "room", label: dict.stayType.room, disabled: !roomPossible },
                { value: "apartment", label: dict.stayType.apartment },
              ]}
              isOn={(v) => v === effectiveStayType}
              onPick={setStayType}
            />
            {!roomPossible && (
              <p className={`mt-2 ${muted}`}>
                {dict.stayType.apartmentOnlyHint.replace("{count}", String(guests))}{" "}
                <span className="opacity-70">
                  ({dict.stayType.roomFitsHint.replace("{max}", String(MAX_GUESTS_PER_ROOM))})
                </span>
              </p>
            )}
          </div>
        </PreferencesPanel>
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
