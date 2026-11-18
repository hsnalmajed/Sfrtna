import { ARAB, GULF, in195, type Visited, type VisitedStats } from "@/lib/visitedMap";

/** Island nations (and island territories we count as countries). */
const ISLANDS = new Set([
  "MV", "MU", "SC", "FJ", "MT", "CY", "LK", "JM", "BS", "BB", "IS", "NZ", "JP", "PH", "SG", "BH", "ID", "CU", "DO", "TT", "CV", "ST", "KM", "MG",
  "PG", "SB", "VU", "WS", "TO", "KI", "MH", "FM", "PW", "NR", "TV", "IE", "GB", "TL", "HT", "LC", "VC", "GD", "AG", "KN", "DM", "TW", "HK",
]);

export type BadgeId = "first" | "c5" | "c10" | "c25" | "c50" | "gulf" | "arab" | "cont3" | "cont6" | "cities10" | "cities50" | "deep" | "islands";

export interface Badge {
  id: BadgeId;
  icon: string;
  /** progress now / needed */
  now: number;
  need: number;
}

export function badgesOf(v: Visited, s: VisitedStats): Badge[] {
  const codes = [...v.countries.keys()];
  const maxCities = Math.max(0, ...[...v.cities.values()].map((x) => x.size));
  const list: Badge[] = [
    { id: "first", icon: "🛂", now: s.countries, need: 1 },
    { id: "c5", icon: "🧳", now: s.countries, need: 5 },
    { id: "c10", icon: "✈️", now: s.countries, need: 10 },
    { id: "c25", icon: "🧭", now: s.countries, need: 25 },
    { id: "c50", icon: "🌍", now: s.countries, need: 50 },
    { id: "gulf", icon: "🌴", now: codes.filter((c) => GULF.includes(c)).length, need: GULF.length },
    { id: "arab", icon: "🕌", now: codes.filter((c) => ARAB.includes(c)).length, need: 10 },
    { id: "cont3", icon: "🗺️", now: s.continents, need: 3 },
    { id: "cont6", icon: "🏆", now: s.continents, need: 6 },
    { id: "cities10", icon: "🏙️", now: s.cities, need: 10 },
    { id: "cities50", icon: "🌆", now: s.cities, need: 50 },
    { id: "deep", icon: "📍", now: maxCities, need: 5 },
    { id: "islands", icon: "🏝️", now: codes.filter((c) => ISLANDS.has(c) && (in195(c) || c === "HK" || c === "TW")).length, need: 3 },
  ];
  return list.map((b) => ({ ...b, now: Math.min(b.now, b.need) }));
}
