"use client";

import { useCallback } from "react";
import type { Locale } from "@/lib/types";
import { COUNTRY_CITIES, type CityEntry } from "@/lib/cities";
import { COUNTRIES } from "@/lib/countries";
import { searchEquals, searchMatches } from "@/lib/search";
import SuggestInput, { type Suggestion } from "@/components/SuggestInput";
import Icon from "@/components/ui/Icon";

/**
 * The hotel city, picked from the cities the site covers. Those are the
 * cities whose hotels we can search and whose partner pages we checked, so
 * a city outside them is said so rather than searched blind.
 */

const ALL: { city: CityEntry; country: string }[] = Object.entries(COUNTRY_CITIES).flatMap(([country, cities]) =>
  cities.map((city) => ({ city, country }))
);

/** "Istanbul, Turkey": the covered city a name stands for, with its country. */
export function hotelCityPlace(name: string): string | undefined {
  const n = name.trim();
  const hit = ALL.find(({ city }) => searchEquals(city.nameEn, n) || searchEquals(city.nameAr, n));
  if (!hit) return undefined;
  const country = COUNTRIES.find((c) => c.code === hit.country);
  return country ? `${hit.city.nameEn}, ${country.nameEn}` : hit.city.nameEn;
}

/** The covered city a name (Arabic or English) stands for, if any. */
export function findHotelCity(name: string): CityEntry | undefined {
  const n = name.trim();
  if (!n) return undefined;
  return ALL.find(({ city }) => searchEquals(city.nameEn, n) || searchEquals(city.nameAr, n))?.city;
}

export default function HotelCityInput({
  id,
  locale,
  value,
  onType,
  onPick,
  className,
  placeholder,
  invalid,
  emptyText,
}: {
  id: string;
  locale: Locale;
  value: string;
  onType: (text: string) => void;
  onPick: (city: CityEntry) => void;
  className: string;
  placeholder?: string;
  invalid?: boolean;
  emptyText?: React.ReactNode;
}) {
  // A country's name lists its cities: "تركيا" is not a place to search
  // hotels in, Istanbul or Antalya is.
  const load = useCallback(
    (q: string): Suggestion[] => {
      const countries = new Set(
        COUNTRIES.filter((c) => searchMatches([c.nameAr, c.nameEn], q)).map((c) => c.code)
      );
      const byCity = ALL.filter(({ city }) => searchMatches([city.nameAr, city.nameEn], q));
      const byCountry = ALL.filter(({ country, city }) => countries.has(country) && !byCity.some((b) => b.city === city));
      return [...byCity, ...byCountry]
        .slice(0, 12)
        .map(({ city, country }) => {
          const c = COUNTRIES.find((x) => x.code === country);
          return {
            key: `${country}-${city.slug}`,
            title: locale === "ar" ? city.nameAr : city.nameEn,
            subtitle: c ? (locale === "ar" ? c.nameAr : c.nameEn) : undefined,
          };
        });
    },
    [locale]
  );

  return (
    <SuggestInput
      id={id}
      value={value}
      onType={onType}
      onPick={(s) => {
        const hit = ALL.find(({ city, country }) => `${country}-${city.slug}` === s.key);
        if (hit) onPick(hit.city);
      }}
      load={load}
      minChars={2}
      className={className}
      placeholder={placeholder}
      invalid={invalid}
      icon={<Icon name="pin" className="h-4.5 w-4.5" />}
      emptyText={emptyText}
    />
  );
}
