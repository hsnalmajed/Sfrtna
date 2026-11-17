"use client";

/**
 * «خريطتي» — the countries and cities a traveller has been to, and the
 * countries they dream of (owner's note G, 14 Nov 2026: a «Been»-style map,
 * tied to the account).
 *
 * Signed in, every mark is an account item (kind "been", keys c:SA,
 * t:TR/istanbul, w:JP) and follows them to every device. Signed out, the
 * marks stay in this browser so the map works on the first visit; the page
 * then offers to keep them in an account, and they move there on sign-in.
 *
 * Shapes come from public/data/world-map.json (scripts/world/build-world.mjs),
 * already projected with Equal Earth; `project` places a city with the same
 * formula and the file's scale and centre.
 *
 * Kept light (no city list): the «المزيد» sheet on every page reads the counts.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { COUNTRIES, type Continent } from "@/lib/countries";
import { useMember } from "@/lib/useMember";
import { BEEN_KEY } from "@/lib/memberItems";

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

export function continentOf(code: string): Continent | undefined {
  return CONTINENT_OF.get(code);
}

export const countryKey = (code: string) => `c:${code}`;
export const wishKey = (code: string) => `w:${code}`;
export const cityKey = (code: string, slug: string) => `t:${code}/${slug}`;

export interface VisitedStats {
  countries: number;
  /** HK, MO, TW and territories marked (not counted in the 195) */
  regions: number;
  cities: number;
  continents: number;
  worldPct: number;
}

export function statsOf(keys: ReadonlySet<string>): VisitedStats {
  let countries = 0, regions = 0, cities = 0;
  const conts = new Set<Continent>();
  for (const k of keys) {
    if (k.startsWith("t:")) cities++;
    else if (k.startsWith("c:")) {
      const code = k.slice(2);
      const cont = CONTINENT_OF.get(code);
      if (cont) conts.add(cont);
      if (cont && !NOT_IN_195.has(code)) countries++;
      else regions++;
    }
  }
  return { countries, regions, cities, continents: conts.size, worldPct: Math.round((countries / WORLD_TOTAL) * 1000) / 10 };
}

/** «دولة واحدة», «دولتان», «5 دول», «12 دولة»: the right Arabic form. */
export function counted(forms: { one: string; two: string; few: string; many: string }, n: number): string {
  const f = n === 1 ? forms.one : n === 2 ? forms.two : n >= 3 && n <= 10 ? forms.few : forms.many;
  return f.replace("{n}", String(n));
}

// ── This browser's marks (signed out) ─────────────────────────────────────
const LOCAL = "sfr-been-v1";
const listeners = new Set<() => void>();
let cache: string[] | null = null;
const NONE: string[] = [];

function readLocal(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOCAL) || "[]") as unknown;
    cache = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === "string" && BEEN_KEY.test(k)) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function writeLocal(keys: string[]) {
  cache = keys;
  try {
    if (keys.length) window.localStorage.setItem(LOCAL, JSON.stringify(keys));
    else window.localStorage.removeItem(LOCAL);
  } catch {
    /* private mode: the marks live until the page closes */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

let moving = false;

/**
 * The marks, wherever they live, and the ways to change them. Marking a city
 * marks its country; unmarking a country unmarks its cities; a visited
 * country is no longer a dream.
 */
export function useVisited() {
  const member = useMember();
  const local = useSyncExternalStore(subscribe, readLocal, () => NONE);
  const accountKeys = member.been.map((b) => b.key);
  const accountSig = accountKeys.join(",");
  const useAccountStore = member.signedIn;

  // First sign-in after marking signed out: the marks move into the account.
  useEffect(() => {
    if (!member.ready || moving || local.length === 0) return;
    moving = true;
    void (async () => {
      const have = new Set(accountSig ? accountSig.split(",") : []);
      for (const k of local) if (!have.has(k)) await member.setBeen(k, true);
      writeLocal([]);
      moving = false;
    })();
    // member.setBeen is rebuilt each render; the keys decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.ready, local, accountSig]);

  const keys = useMemo(
    () => new Set<string>(useAccountStore ? [...(accountSig ? accountSig.split(",") : []), ...local] : local),
    [useAccountStore, accountSig, local]
  );

  const apply = async (on: string[], off: string[]) => {
    if (useAccountStore) {
      let ok = true;
      for (const k of off) if (keys.has(k)) ok = (await member.setBeen(k, false)) && ok;
      for (const k of on) if (!keys.has(k)) ok = (await member.setBeen(k, true)) && ok;
      return ok;
    }
    const next = new Set(readLocal());
    off.forEach((k) => next.delete(k));
    on.forEach((k) => next.add(k));
    writeLocal([...next]);
    return true;
  };

  return {
    keys,
    stats: statsOf(keys),
    signedIn: member.signedIn,
    /** The account's marks have not arrived yet. */
    loading: member.signedIn && !member.ready,
    toggleCountry(code: string) {
      if (keys.has(countryKey(code))) {
        const cities = [...keys].filter((k) => k.startsWith(`t:${code}/`));
        return apply([], [countryKey(code), ...cities]);
      }
      return apply([countryKey(code)], [wishKey(code)]);
    },
    toggleCity(code: string, slug: string) {
      const k = cityKey(code, slug);
      if (keys.has(k)) return apply([], [k]);
      return apply([k, countryKey(code)], [wishKey(code)]);
    },
    toggleWish(code: string) {
      const k = wishKey(code);
      return keys.has(k) ? apply([], [k]) : apply([k], []);
    },
  };
}

/** For the «المزيد» card: the counts, without loading the shapes. */
export function useVisitedStats(): VisitedStats {
  return useVisited().stats;
}
