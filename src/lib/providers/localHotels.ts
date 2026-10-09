import { COUNTRY_CITIES, type CityEntry } from "@/lib/cities";
import { COUNTRIES } from "@/lib/countries";
import { normalizeSearch } from "@/lib/search";
import {
  dictionaryForms,
  isGeneric,
  joinPhrases,
  shardKey,
  stem,
  wordForms,
  words,
  type StoredHotel,
} from "@/lib/hotelIndex";

/**
 * Hotel names from our own stored files (see src/lib/hotelIndex.ts): no
 * outside call, no allowance, no waiting. Reads one to four small files per
 * search through the Worker's asset binding.
 */

export interface LocalHotel {
  name: string;
  /** "Istanbul, Turkey" — carried to the price search. */
  area: string;
  nameAr?: string;
  stars?: number;
}

export interface GuessedCity {
  slug: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface CityInfo extends GuessedCity {
  countryEn: string;
  /** Folded names to recognise in a query: English, Arabic, Arabic without ال. */
  keys: string[][];
}

let citiesCache: Map<string, CityInfo> | null = null;

function cities(): Map<string, CityInfo> {
  if (citiesCache) return citiesCache;
  const map = new Map<string, CityInfo>();
  for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
    const countryEn = COUNTRIES.find((c) => c.code === code)?.nameEn ?? code;
    for (const c of list as CityEntry[]) {
      const variants = new Set<string>();
      for (const n of [c.nameEn, c.nameAr]) {
        const w = words(n);
        variants.add(w.join(" "));
        variants.add(w.map(stem).join(" "));
      }
      map.set(c.slug, {
        slug: c.slug,
        code,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        countryEn,
        keys: [...variants].filter(Boolean).map((v) => v.split(" ")),
      });
    }
  }
  citiesCache = map;
  return map;
}

/**
 * The city named in the query, and the query's other words. The last word may
 * be half-typed («هيلتون اسطن»): three letters that begin a city's name count.
 */
function splitCity(ws: string[]): { city: CityInfo | null; rest: string[] } {
  let best: { city: CityInfo; at: number; len: number; chars: number } | null = null;
  const stems = ws.map(stem);
  for (const city of cities().values()) {
    for (const key of city.keys) {
      for (let at = 0; at + key.length <= ws.length; at++) {
        const ok = key.every((k, j) => {
          const w = ws[at + j];
          const s = stems[at + j];
          const last = at + j === ws.length - 1 && j === key.length - 1;
          return w === k || s === k || (last && w.length >= 3 && k.startsWith(w));
        });
        const chars = key.join(" ").length;
        if (ok && (!best || chars > best.chars)) best = { city, at, len: key.length, chars };
      }
    }
  }
  if (!best) return { city: null, rest: ws };
  return { city: best.city, rest: [...ws.slice(0, best.at), ...ws.slice(best.at + best.len)] };
}

type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };

async function readData<T>(path: string): Promise<T | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    let assets: AssetsBinding | undefined;
    try {
      assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetsBinding }).ASSETS;
    } catch {
      assets = undefined;
    }
    if (!assets) {
      if (process.env.NODE_ENV === "production" && !process.env.SFRTNA_LOCAL_PLACES) return null;
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(`${process.cwd()}/public/data/${path}`, "utf8").catch(() => null);
      return text ? (JSON.parse(text) as T) : null;
    }
    const res = await assets.fetch(new Request(`https://assets.local/data/${path}`));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function toLocal(h: StoredHotel): LocalHotel {
  const city = cities().get(h[0]);
  return {
    name: h[1],
    area: city ? `${city.nameEn}, ${city.countryEn}` : "",
    nameAr: h[2] || undefined,
    stars: h[3] || undefined,
  };
}

/** Does any form of a typed word appear in the hotel (its names or its city)? */
function matches(forms: string[], hotelWords: string[], hotelText: string): boolean {
  return forms.some((f) =>
    f.includes(" ") ? hotelText.includes(f) : hotelWords.some((w) => w.startsWith(f))
  );
}

export async function localHotels(q: string): Promise<{ items: LocalHotel[]; city: GuessedCity | null }> {
  const { city, rest } = splitCity(words(q));
  const guessed: GuessedCity | null = city
    ? { slug: city.slug, code: city.code, nameAr: city.nameAr, nameEn: city.nameEn }
    : null;
  const terms = joinPhrases(rest)
    .filter((w) => !isGeneric(w))
    .map((w) => {
      const forms = w.includes(" ") ? [w, ...dictionaryForms(w), ...dictionaryForms(w).map((f) => f.replace(/\s+/g, ""))] : wordForms(w);
      return { word: w, forms: [...new Set(forms)].filter((f) => f.length >= 2) };
    })
    .filter((t) => t.forms.length);

  // Only a city («ابها فندق», "hotels in Jeddah"): its best hotels.
  if (!terms.length) {
    if (!city) return { items: [], city: null };
    const list = (await readData<StoredHotel[]>(`hotels/${city.slug}.json`)) ?? [];
    return { items: list.slice(0, 8).map(toLocal), city: guessed };
  }

  // The longest word picks the files: it is the one fewest hotels share.
  const lead = [...terms].sort((a, b) => stem(b.word).length - stem(a.word).length)[0];
  const keys = [...new Set(lead.forms.map((f) => shardKey(f.split(" ")[0])).filter((k): k is string => Boolean(k)))].slice(0, 4);
  const lists = await Promise.all(keys.map((k) => readData<StoredHotel[]>(`hotel-words/${k}.json`)));

  const seen = new Set<string>();
  const found: { h: StoredHotel; exact: number }[] = [];
  for (const list of lists) {
    for (const h of list ?? []) {
      if (city && h[0] !== city.slug) continue;
      const id = `${h[0]}|${h[1]}`;
      if (seen.has(id)) continue;
      const c = cities().get(h[0]);
      const text = normalizeSearch([h[1], h[2], h[4], c?.nameEn, c?.nameAr].filter(Boolean).join(" "));
      const hw = words(text).map(stem);
      if (!terms.every((t) => matches(t.forms, hw, text))) continue;
      seen.add(id);
      const exact = terms.filter((t) => t.forms.some((f) => hw.includes(f))).length;
      found.push({ h, exact });
    }
  }
  found.sort((a, b) => b.exact - a.exact || b.h[3] - a.h[3]);
  return { items: found.slice(0, 8).map((f) => toLocal(f.h)), city: guessed };
}
