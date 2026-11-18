"use client";

/**
 * «خريطتي» — the countries and cities a traveller has been to, and the
 * countries they dream of (owner's note G, 14 Nov 2026; rebuilt to the
 * owner's spec of 18 Nov: account only, trips per country).
 *
 * Every mark is an account item (kind "been"):
 *   c:SA            a visited country; data.v = one entry per trip (year, 0 = not given)
 *   t:TR/istanbul   a visited city: our guide slug, or q<Wikidata number> from
 *                   public/geo/cities/<CC>.json (src/lib/visitedCities.ts)
 *   w:JP            a dream
 *
 * Shapes come from public/geo/world-map.json (scripts/world/build-world.mjs),
 * already projected with Equal Earth; `project` places a city with the same
 * formula. Kept light (no city list): the «المزيد» sheet reads the counts.
 */

import { useMemo } from "react";
import { COUNTRIES, type Continent } from "@/lib/countries";
import { useMember } from "@/lib/useMember";
import { useAccount } from "@/lib/useAccount";
import type { Been } from "@/lib/memberItems";

export interface WorldCountry {
  /** ISO 3166-1 alpha-2 */
  c: string;
  /** SVG path in the file's frame ("" = too small, drawn as a dot) */
  d: string;
  /** bounds x0, y0, x1, y1 */
  b: [number, number, number, number];
  /** centre of its main land */
  p: [number, number];
  ar?: string;
  en?: string;
}

export interface WorldMapFile {
  w: number;
  h: number;
  proj: { k: number; tx: number; ty: number };
  sphere: string;
  countries: WorldCountry[];
}

/** Equal Earth (Šavrič, Patterson, Jenny 2018), as d3-geo draws it. */
export function project(lat: number, lon: number, p: WorldMapFile["proj"]): [number, number] {
  const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const l = Math.asin(M * Math.sin(phi));
  const l2 = l * l, l6 = l2 * l2 * l2;
  const x = (lambda * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
  return [p.tx + p.k * x, p.ty - p.k * y];
}

/** Places counted as their own country here but not in the 195 (UN + 2). */
const NOT_IN_195 = new Set(["HK", "MO", "TW"]);
const CONTINENT_OF = new Map<string, Continent>(COUNTRIES.map((c) => [c.code, c.continent]));
export const WORLD_TOTAL = COUNTRIES.filter((c) => !NOT_IN_195.has(c.code)).length;
export const GULF = ["SA", "AE", "KW", "QA", "BH", "OM"];
export const ARAB = ["SA", "AE", "KW", "QA", "BH", "OM", "YE", "IQ", "SY", "JO", "LB", "PS", "EG", "SD", "LY", "TN", "DZ", "MA", "MR", "SO", "DJ", "KM"];

export function continentOf(code: string): Continent | undefined {
  return CONTINENT_OF.get(code);
}
export function in195(code: string): boolean {
  return CONTINENT_OF.has(code) && !NOT_IN_195.has(code);
}

export const countryKey = (code: string) => `c:${code}`;
export const wishKey = (code: string) => `w:${code}`;
export const cityKey = (code: string, id: string) => `t:${code}/${id}`;

/** «دولة واحدة», «دولتان», «5 دول», «12 دولة»: the right Arabic form. */
export function counted(forms: { one: string; two: string; few: string; many: string }, n: number): string {
  const f = n === 1 ? forms.one : n === 2 ? forms.two : n >= 3 && n <= 10 ? forms.few : forms.many;
  return f.replace("{n}", String(n));
}

export interface Visited {
  /** visited countries → their trips (years, 0 = not given) */
  countries: Map<string, number[]>;
  /** visited cities per country: city ids */
  cities: Map<string, Set<string>>;
  dreams: Set<string>;
}

export interface VisitedStats {
  countries: number;
  /** HK, MO, TW and territories marked (not counted in the 195) */
  regions: number;
  cities: number;
  continents: number;
  trips: number;
  worldPct: number;
}

export function readVisited(items: { key: string; data: Been | undefined }[]): Visited {
  const v: Visited = { countries: new Map(), cities: new Map(), dreams: new Set() };
  for (const { key, data } of items) {
    if (key.startsWith("c:")) v.countries.set(key.slice(2), data?.v?.length ? data.v : [0]);
    else if (key.startsWith("w:")) v.dreams.add(key.slice(2));
    else if (key.startsWith("t:")) {
      const [code, id] = key.slice(2).split("/");
      if (!v.cities.has(code)) v.cities.set(code, new Set());
      v.cities.get(code)!.add(id);
    }
  }
  return v;
}

export function statsOf(v: Visited): VisitedStats {
  let countries = 0, regions = 0, trips = 0, cities = 0;
  const conts = new Set<Continent>();
  for (const [code, t] of v.countries) {
    trips += t.length;
    const cont = CONTINENT_OF.get(code);
    if (cont) conts.add(cont);
    if (in195(code)) countries++;
    else regions++;
  }
  for (const s of v.cities.values()) cities += s.size;
  return { countries, regions, cities, continents: conts.size, trips, worldPct: Math.round((countries / WORLD_TOTAL) * 1000) / 10 };
}

/** The marks of the signed-in traveller, and the ways to change them. */
export function useVisited() {
  const member = useMember();
  const account = useAccount();
  const sig = member.been.map((b) => `${b.key}=${JSON.stringify(b.data)}`).join("|");
  const visited = useMemo(
    () => readVisited(member.been.map((b) => ({ key: b.key, data: b.data as Been | undefined }))),
    // the signature carries every key and value
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig]
  );
  const stats = useMemo(() => statsOf(visited), [visited]);

  /**
   * Save one country as the «+» sheet left it: its cities exactly as ticked,
   * and, when `trip` is given, one more trip (its year, 0 = not given).
   */
  async function saveCountry(code: string, cityIds: Set<string>, trip: number | null) {
    let ok = true;
    const trips = visited.countries.get(code);
    const nextTrips = trips ? (trip === null ? trips : [...trips, trip]) : [trip ?? 0];
    ok = (await member.setBeen(countryKey(code), true, { at: Date.now(), v: nextTrips })) && ok;
    if (visited.dreams.has(code)) ok = (await member.setBeen(wishKey(code), false)) && ok;
    const had = visited.cities.get(code) ?? new Set<string>();
    for (const id of had) if (!cityIds.has(id)) ok = (await member.setBeen(cityKey(code, id), false)) && ok;
    for (const id of cityIds) if (!had.has(id)) ok = (await member.setBeen(cityKey(code, id), true, { at: Date.now() })) && ok;
    return ok;
  }

  async function setTrips(code: string, trips: number[]) {
    if (!trips.length) return removeCountry(code);
    return member.setBeen(countryKey(code), true, { at: Date.now(), v: trips });
  }

  async function removeCountry(code: string) {
    let ok = true;
    for (const id of visited.cities.get(code) ?? []) ok = (await member.setBeen(cityKey(code, id), false)) && ok;
    return (await member.setBeen(countryKey(code), false)) && ok;
  }

  async function toggleDream(code: string) {
    return member.setBeen(wishKey(code), !visited.dreams.has(code), { at: Date.now() });
  }

  return {
    visited,
    stats,
    signedIn: member.signedIn,
    /** Still finding out who this is, or their marks have not arrived. */
    loading: account.status !== "ready" || (member.signedIn && !member.ready),
    saveCountry,
    setTrips,
    removeCountry,
    toggleDream,
  };
}

/** For the «المزيد» sheet and «حسابي»: the counts only. */
export function useVisitedStats(): VisitedStats {
  return useVisited().stats;
}
