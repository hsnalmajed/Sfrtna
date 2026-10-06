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
  const load = useCallback(
    (q: string): Suggestion[] =>
      ALL.filter(({ city }) => searchMatches([city.nameAr, city.nameEn], q))
        .slice(0, 8)
        .map(({ city, country }) => {
          const c = COUNTRIES.find((x) => x.code === country);
          return {
            key: `${country}-${city.slug}`,
            title: locale === "ar" ? city.nameAr : city.nameEn,
            subtitle: c ? (locale === "ar" ? c.nameAr : c.nameEn) : undefined,
          };
        }),
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
