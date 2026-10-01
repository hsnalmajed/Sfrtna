import "server-only";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DEFAULT_ORIGIN, ORIGIN_COOKIE, nearestAirport, originInfo, type OriginInfo } from "@/lib/originInfo";

/**
 * Where this visitor flies from.
 *
 *   1. The airport they chose ("Flying from: Dammam · change"), kept in a
 *      cookie.
 *   2. Otherwise the nearest airport to where Cloudflare places their
 *      connection (city-level, from the IP address — nothing is asked and
 *      nothing is stored). Al-Ahsa → Dammam.
 *   3. Otherwise Riyadh.
 *
 * Reading the cookie makes the page dynamic, which every page that calls this
 * already is (prices are per request).
 */
export async function userOrigin(): Promise<OriginInfo> {
  try {
    const chosen = originInfo((await cookies()).get(ORIGIN_COOKIE)?.value, "chosen");
    if (chosen) return chosen;
  } catch {
    // No request scope (build time): fall through.
  }
  try {
    const cf = getCloudflareContext().cf as { latitude?: string; longitude?: string } | undefined;
    const lat = Number(cf?.latitude);
    const lon = Number(cf?.longitude);
    if (cf?.latitude && cf?.longitude && Number.isFinite(lat) && Number.isFinite(lon)) {
      const located = originInfo(nearestAirport(lat, lon), "located");
      if (located) return located;
    }
  } catch {
    // Not on Cloudflare (next dev): fall through.
  }
  return originInfo(DEFAULT_ORIGIN, "default") as OriginInfo;
}
