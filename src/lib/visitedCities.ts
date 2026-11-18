"use client";

/**
 * The cities a traveller can tick in a country on «خريطتي»: our own guide
 * cities first (they link to their guide), then the country's other big
 * cities from public/geo/cities/<CC>.json (scripts/world/build-cities.mjs),
 * without near-duplicates of ours. Loaded per country, on demand, cached.
 */

import { COUNTRY_CITIES } from "@/lib/cities";
import { CITY_COORDS } from "@/data/cityCoords";
import { normalizeSearch } from "@/lib/search";

export interface MapCity {
  /** our slug, or q<Wikidata number> */
  id: string;
  ar: string;
  en: string;
  lat: number;
  lon: number;
  /** one of our 365 guide cities */
  ours: boolean;
}

type Row = [number, string, string, number, number, number];
const cache = new Map<string, Promise<MapCity[]>>();

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

export function ourCities(code: string): MapCity[] {
  return (COUNTRY_CITIES[code] ?? []).flatMap((c) => {
    const at = CITY_COORDS[c.slug];
    return at ? [{ id: c.slug, ar: c.nameAr, en: c.nameEn, lat: at.lat, lon: at.lon, ours: true }] : [];
  });
}

export function citiesOf(code: string): Promise<MapCity[]> {
  let p = cache.get(code);
  if (!p) {
    p = (async () => {
      const ours = ourCities(code);
      let rows: Row[] = [];
      try {
        const res = await fetch(`/geo/cities/${code}.json`);
        if (res.ok) rows = (await res.json()) as Row[];
      } catch {
        /* our own cities still show */
      }
      const names = new Set(ours.map((c) => normalizeSearch(c.en)));
      const more: MapCity[] = [];
      for (const [q, ar, en, lat, lon] of rows) {
        const c = { id: `q${q}`, ar: ar || en, en, lat, lon, ours: false };
        if (names.has(normalizeSearch(en)) || ours.some((o) => km(o, c) < 12)) continue;
        names.add(normalizeSearch(en));
        more.push(c);
      }
      return [...ours, ...more];
    })();
    cache.set(code, p);
  }
  return p;
}
