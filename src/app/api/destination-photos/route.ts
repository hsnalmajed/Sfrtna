import { NextResponse } from "next/server";
import { DESTINATIONS } from "@/lib/destinations";
import { placeForDestination } from "@/lib/destinationPlace";
import { fetchCityPhotos } from "@/lib/countryPhotos";

/**
 * Photographs for every "suggest a destination" city, keyed "CC/city-slug".
 *
 * Its own request rather than part of /api/discover: that one already spends
 * most of a Worker's subrequest allowance on fares, and a cold photo set
 * would push it over. The set is the same for every search, so after the
 * first visit it is one cache read.
 */
export async function GET() {
  const cities = DESTINATIONS.map((d) => placeForDestination(d.code, d.nameEn, 1))
    .filter((p) => p !== undefined)
    .map((p) => ({ code: p.countryCode, slug: p.citySlug, nameEn: p.cityNameEn }));
  const photos = await fetchCityPhotos(cities);
  return NextResponse.json(Object.fromEntries(photos), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
