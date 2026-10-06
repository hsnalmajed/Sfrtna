"use client";

import { useCallback } from "react";
import type { HotelSuggestion } from "@/lib/providers/googlePlaces";
import SuggestInput, { type Suggestion } from "@/components/SuggestInput";
import Icon from "@/components/ui/Icon";

/**
 * The hotel's name, picked from Google's hotel names (OpenStreetMap's when
 * Google cannot answer) as the traveller types — from the third letter,
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
}) {
  const load = useCallback(async (q: string): Promise<Suggestion[]> => {
    const res = await fetch(`/api/hotel-suggest?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: HotelSuggestion[] };
    return (body.items ?? []).map((h) => ({ key: `${h.name}|${h.area}`, title: h.name, subtitle: h.area }));
  }, []);

  return (
    <SuggestInput
      id={id}
      value={value}
      onType={onType}
      onPick={(s) => onPick({ name: s.title, area: s.subtitle ?? "" })}
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
