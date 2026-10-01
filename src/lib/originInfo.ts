/**
 * The traveller's departure airport, as plain data — safe on the server and
 * in the browser. Which airport that is for a given visitor is decided in
 * src/lib/origin.ts (server) and /api/origin.
 */
import { AIRPORT_COORDS } from "@/data/airportCoords";
import { AIRPORTS, findAirport } from "@/lib/airports";

export const ORIGIN_COOKIE = "sfrtna_origin";
export const DEFAULT_ORIGIN = "RUH";

export interface OriginInfo {
  iata: string;
  cityAr: string;
  cityEn: string;
  lat: number;
  lon: number;
  /** How we know: they chose it, we located them, or neither. */
  source: "chosen" | "located" | "default";
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** An airport we can fly from: listed in the search forms and located. */
export function originInfo(code: string | undefined | null, source: OriginInfo["source"]): OriginInfo | null {
  if (!code) return null;
  const iata = code.trim().toUpperCase();
  const coords = AIRPORT_COORDS[iata];
  const airport = findAirport(iata);
  if (!coords || !airport) return null;
  return { iata, cityAr: airport.cityAr, cityEn: airport.cityEn, lat: coords[0], lon: coords[1], source };
}

/**
 * The nearest airport the site lists to a point — Al-Ahsa gives Dammam,
 * Abha gives Abha. Only the airports in the search forms count, so the
 * answer is always one a traveller can search from.
 */
export function nearestAirport(lat: number, lon: number): string | null {
  let best: string | null = null;
  let bestKm = Infinity;
  for (const a of AIRPORTS) {
    const c = AIRPORT_COORDS[a.iata];
    if (!c) continue;
    const d = km({ lat, lon }, { lat: c[0], lon: c[1] });
    if (d < bestKm) {
      bestKm = d;
      best = a.iata;
    }
  }
  return best;
}

/**
 * Roughly how long a flight takes, in whole hours: the great-circle distance
 * at a typical cruise speed, plus half an hour for climb and descent.
 * Precise enough to tell a weekend break from a long haul; never presented
 * as a schedule. Undefined under 200 km.
 */
export function flightHoursBetween(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number | undefined {
  const d = km(from, to);
  if (d <= 200) return undefined;
  return Math.max(1, Math.round(d / 800 + 0.5));
}
