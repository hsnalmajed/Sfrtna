"use client";

import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import HotelNameInput from "@/components/HotelNameInput";
import { BudgetInput, ChoiceChips, FieldLabel, PreferencesPanel, RoomsStepper, Toggle } from "@/components/PlannerFields";
import { MAX_ROOMS } from "@/lib/rooms";
import Icon from "@/components/ui/Icon";
import type { ComboHotel } from "@/lib/combo";
import { AMENITIES, PLACE_KINDS, RATING_FLOORS, RATING_LABEL, type Amenity, type PlaceKind, type RatingFloor } from "@/lib/hotelPrefs";

/**
 * The hotel half of «طيران + فندق», under the flight fields of the flight
 * planner: a hotel by name (optional — empty means "suggest hotels in my
 * destination"), the hotel's own budget, and the hotel's own preferences.
 * The flight's budget and preferences stay above, untouched.
 */
export default function ComboHotelFields({
  locale,
  dark,
  inputClass,
  discover,
  value,
  onChange,
  currency,
  onCurrencyChange,
  errors,
  adults,
}: {
  /** Adults on the trip: at most one room each. */
  adults: number;
  locale: Locale;
  dark: boolean;
  inputClass: string;
  /** "Suggest a destination": no hotel name — the destination is not chosen yet. */
  discover: boolean;
  value: ComboHotel;
  onChange: (v: ComboHotel) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  errors: { hotel?: string; hotelBudget?: string };
}) {
  const dict = useDictionary();
  const c = dict.combo;
  const hp = dict.hotelPrefs;
  const set = <K extends keyof ComboHotel>(k: K, v: ComboHotel[K]) => onChange({ ...value, [k]: v });
  const setPref = <K extends keyof ComboHotel["prefs"]>(k: K, v: ComboHotel["prefs"][K]) =>
    onChange({ ...value, prefs: { ...value.prefs, [k]: v } });
  const errorClass = `mt-1.5 text-xs font-semibold ${dark ? "text-rose-300" : "text-red-600"}`;

  return (
    <section
      className={`mt-5 rounded-2xl p-4 ring-1 sm:p-5 ${dark ? "bg-white/[0.04] ring-white/15" : "bg-mist-50 ring-mist-200"}`}
      aria-label={c.hotelTitle}
    >
      <p className={`flex items-center gap-2 font-display text-base font-extrabold ${dark ? "text-white" : "text-navy-950"}`}>
        <Icon name="hotel" className={`h-5 w-5 ${dark ? "text-sun-400" : "text-sun-600"}`} />
        {c.hotelTitle}
      </p>
      <p className={`mt-1 text-xs ${dark ? "text-white/60" : "text-navy-500"}`}>{discover ? c.hotelHintDiscover : c.hotelHint}</p>

      <div className="mt-4 grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
        {!discover && (
          <div data-field="hotel">
            <FieldLabel dark={dark} icon="hotel" htmlFor="combo-hotel">
              {c.hotelName}
            </FieldLabel>
            <HotelNameInput
              id="combo-hotel"
              className={inputClass}
              value={value.label || value.name}
              placeholder={dict.hotelForm.hotelNamePlaceholder}
              invalid={Boolean(errors.hotel)}
              loadingText={dict.hotelForm.searchingHotels}
              arabic={locale === "ar"}
              onType={(text) => onChange({ ...value, name: text, label: "", area: "", areaLabel: "", picked: false })}
              onPick={(h) =>
                onChange({
                  ...value,
                  name: h.name,
                  area: h.area,
                  label: locale === "ar" && h.nameAr ? h.nameAr : "",
                  areaLabel: locale === "ar" && h.areaAr ? h.areaAr : "",
                  picked: true,
                })
              }
            />
            {errors.hotel && (
              <p role="alert" className={errorClass}>
                {errors.hotel}
              </p>
            )}
          </div>
        )}
        <RoomsStepper
          dark={dark}
          value={Math.min(value.rooms, Math.max(1, adults))}
          max={Math.min(MAX_ROOMS, Math.max(1, adults))}
          onChange={(n) => set("rooms", n)}
          label={dict.hotelForm.rooms}
          less={dict.hotelForm.roomsLess}
          more={dict.hotelForm.roomsMore}
        />
        <div data-field="hotelBudget">
          <BudgetInput
            id="combo-hotel-budget"
            locale={locale}
            dark={dark}
            label={c.hotelBudget}
            placeholder={dict.hotelForm.budgetPlaceholder}
            currencyLabel={dict.form.currency}
            value={value.budget}
            onChange={(v) => set("budget", v)}
            currency={currency}
            onCurrencyChange={onCurrencyChange}
            error={errors.hotelBudget}
          />
        </div>
      </div>

      <PreferencesPanel
        dark={dark}
        title={c.prefsTitle}
        hint={dict.form.extrasHint}
        chosen={[
          ...(value.prefs.place ? [hp.place[value.prefs.place]] : []),
          ...(value.breakfast ? [dict.form.breakfastShort] : []),
          ...(value.minStars ? ["★".repeat(value.minStars)] : []),
          ...(value.prefs.rating ? [`${hp.ratingLabel} ${RATING_LABEL[value.prefs.rating]}`] : []),
          ...(value.prefs.freeCancel ? [hp.freeCancel] : []),
          ...value.prefs.amenities.map((a) => hp.amenity[a]),
        ]}
      >
        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
          <Toggle dark={dark} id="combo-breakfast" checked={value.breakfast} onChange={(v) => set("breakfast", v)} icon="coffee">
            {dict.form.breakfastShort}
          </Toggle>
          <Toggle dark={dark} id="combo-free-cancel" checked={value.prefs.freeCancel} onChange={(v) => setPref("freeCancel", v)} icon="shield">
            {hp.freeCancel}
          </Toggle>
        </div>
        <div>
          <FieldLabel dark={dark} icon="star">
            {dict.form.minStars}
          </FieldLabel>
          <ChoiceChips<number>
            dark={dark}
            options={[{ value: 0, label: dict.form.anyStars }, ...[2, 3, 4, 5].map((n) => ({ value: n, label: "★".repeat(n) }))]}
            isOn={(v) => v === value.minStars}
            onPick={(v) => set("minStars", v)}
          />
        </div>
        <div>
          <FieldLabel dark={dark} icon="bed">
            {hp.placeLabel}
          </FieldLabel>
          <ChoiceChips<PlaceKind>
            dark={dark}
            options={PLACE_KINDS.map((k) => ({ value: k, label: hp.place[k] }))}
            isOn={(v) => v === value.prefs.place}
            onPick={(v) => setPref("place", v)}
          />
        </div>
        <div>
          <FieldLabel dark={dark} icon="star">
            {hp.ratingLabel}
          </FieldLabel>
          <ChoiceChips<RatingFloor>
            dark={dark}
            options={RATING_FLOORS.map((r) => ({ value: r, label: r ? hp.ratingFloor.replace("{r}", RATING_LABEL[r]) : hp.ratingAny }))}
            isOn={(v) => v === value.prefs.rating}
            onPick={(v) => setPref("rating", v)}
          />
        </div>
        <div>
          <FieldLabel dark={dark} icon="check">
            {hp.amenitiesLabel}
          </FieldLabel>
          <ChoiceChips<Amenity>
            dark={dark}
            options={AMENITIES.map((a) => ({ value: a, label: `${value.prefs.amenities.includes(a) ? "✓ " : ""}${hp.amenity[a]}` }))}
            isOn={(v) => value.prefs.amenities.includes(v)}
            onPick={(v) =>
              setPref("amenities", value.prefs.amenities.includes(v) ? value.prefs.amenities.filter((x) => x !== v) : [...value.prefs.amenities, v])
            }
          />
        </div>
      </PreferencesPanel>
    </section>
  );
}
