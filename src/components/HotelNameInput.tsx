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
}) {
  // What each shown row stands for: the row shows the Arabic name, the pick
  // carries the name and place the price search needs.
  const byKey = useRef(new Map<string, HotelSuggestion>());
  const load = useCallback(async (q: string): Promise<Suggestion[]> => {
    const res = await fetch(`/api/hotel-suggest?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: HotelSuggestion[]; city?: GuessedCity | null };
    onCityGuess?.(body.city ?? null);
    return (body.items ?? []).map((h) => {
      const key = `${h.name}|${h.area}`;
      byKey.current.set(key, h);
      const subtitle = arabic && h.nameAr && h.nameAr !== h.name ? `${h.nameAr} · ${h.area}` : h.area;
      return { key, title: h.name, subtitle };
    });
  }, [arabic, onCityGuess]);

  return (
    <SuggestInput
      id={id}
      value={value}
      onType={onType}
      onPick={(s) => onPick(byKey.current.get(s.key) ?? { name: s.title, area: s.subtitle ?? "" })}
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
