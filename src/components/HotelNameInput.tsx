"use client";

import { useCallback, useRef } from "react";
import type { HotelSuggestion } from "@/lib/providers/hotelNames";
import type { GuessedCity } from "@/lib/providers/localHotels";
import SuggestInput, { type Suggestion } from "@/components/SuggestInput";
import Icon from "@/components/ui/Icon";

/**
 * The hotel's name, picked from a list as the traveller types (our stored
 * hotels first, see hotelSuggestions) — from the third letter,
 * after a short pause, so a word costs one lookup rather than one per key.
 * A pick carries where the hotel is, so the price search finds the right one
 * of several namesakes.
 */
export default function HotelNameInput({
  id,
  value,
  onType,
  onPick,
  className,
  placeholder,
  invalid,
  emptyText,
  loadingText,
  arabic,
  onCityGuess,
  cityOption,
  onPickCity,
}: {
  id: string;
  value: string;
  onType: (text: string) => void;
  onPick: (s: HotelSuggestion) => void;
  className: string;
  placeholder?: string;
  invalid?: boolean;
  emptyText?: React.ReactNode;
  loadingText?: string;
  /** Show each hotel's Arabic name under it, when known. */
  arabic?: boolean;
  /** The city the typed text names, if any — for "search that city instead". */
  onCityGuess?: (city: GuessedCity | null) => void;
  /**
   * The box takes a hotel OR a city (owner, 27 Oct): when the text names a
   * city, its first row is "every hotel in <city>" — `{city}` in the
   * template — and picking it calls onPickCity.
   */
  cityOption?: { title: string; subtitle: string };
  onPickCity?: (city: GuessedCity) => void;
}) {
  // What each shown row stands for: the row shows the Arabic name, the pick
  // carries the name and place the price search needs.
  const byKey = useRef(new Map<string, HotelSuggestion>());
  const cityByKey = useRef(new Map<string, GuessedCity>());
  const load = useCallback(async (q: string): Promise<Suggestion[]> => {
    const res = await fetch(`/api/hotel-suggest?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: HotelSuggestion[]; city?: GuessedCity | null };
    onCityGuess?.(body.city ?? null);
    const cityRow: Suggestion[] =
      body.city && cityOption && onPickCity
        ? [
            {
              key: `city:${body.city.nameEn}`,
              title: cityOption.title.replace("{city}", arabic ? body.city.nameAr : body.city.nameEn),
              subtitle: cityOption.subtitle,
            },
          ]
        : [];
    if (body.city) cityByKey.current.set(`city:${body.city.nameEn}`, body.city);
    return [...cityRow, ...(body.items ?? []).map((h) => {
      const key = `${h.name}|${h.area}`;
      byKey.current.set(key, h);
      // The page's language first (owner, 20 Oct): the Arabic page shows the
      // Arabic name and area, with the hotel's own name under it; the English
      // page shows the Latin name.
      if (arabic) {
        const title = h.nameAr || h.name;
        const area = h.areaAr || h.area;
        return { key, title, subtitle: h.nameAr && h.nameAr !== h.name ? `${h.name} · ${area}` : area };
      }
      return { key, title: h.name, subtitle: h.area };
    })];
  }, [arabic, onCityGuess, cityOption, onPickCity]);

  return (
    <SuggestInput
      id={id}
      value={value}
      onType={onType}
      onPick={(s) => {
        const city = cityByKey.current.get(s.key);
        if (city && onPickCity) return onPickCity(city);
        onPick(byKey.current.get(s.key) ?? { name: s.title, area: s.subtitle ?? "" });
      }}
      load={load}
      minChars={3}
      delayMs={350}
      className={className}
      placeholder={placeholder}
      invalid={invalid}
      icon={<Icon name="hotel" className="h-4.5 w-4.5" />}
      emptyText={emptyText}
      loadingText={loadingText}
    />
  );
}
