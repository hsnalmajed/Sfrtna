"use client";

import { useEffect, useState } from "react";
import type { HotelPrefs } from "@/lib/hotelPrefs";
import { ChoiceChips, FieldLabel } from "@/components/PlannerFields";

type Anchor = { an: string; en: string; y: number; x: number };

/**
 * «قريب من» (owner, 27 Oct: choose the area, as on Booking): the city centre,
 * or one of the city's best-known places from our guide. Distances on the
 * hotel list are then measured from it, and «القرب» limits to it.
 */
export default function NearToPicker({
  dark,
  citySlug,
  arabic,
  value,
  onChange,
  t,
}: {
  dark: boolean;
  citySlug?: string;
  arabic: boolean;
  value: HotelPrefs["nearTo"];
  onChange: (v: HotelPrefs["nearTo"]) => void;
  t: { label: string; centre: string };
}) {
  const [anchors, setAnchors] = useState<{ slug: string; items: Anchor[] } | null>(null);
  useEffect(() => {
    if (!citySlug) return;
    let live = true;
    fetch(`/api/anchors?city=${encodeURIComponent(citySlug)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((b: { items?: Anchor[] }) => live && setAnchors({ slug: citySlug, items: b.items ?? [] }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [citySlug]);
  const items = anchors && anchors.slug === citySlug ? anchors.items : [];
  if (!citySlug || !items.length) return null;
  const nameOf = (a: Anchor) => (arabic ? a.an : a.en);
  return (
    <div>
      <FieldLabel dark={dark} icon="pin">
        {t.label}
      </FieldLabel>
      <ChoiceChips<string>
        dark={dark}
        options={[{ value: "", label: t.centre }, ...items.map((a) => ({ value: nameOf(a), label: nameOf(a) }))]}
        isOn={(v) => (v === "" ? !value : value?.n === v)}
        onPick={(v) => {
          const a = items.find((x) => nameOf(x) === v);
          onChange(a ? { n: nameOf(a), y: a.y, x: a.x } : undefined);
        }}
      />
    </div>
  );
}
