import { COUNTRY_CITIES } from "@/lib/cities";
import { COUNTRIES } from "@/lib/countries";

/**
 * The cities the iPhone app's native «خطّط» screen searches
 * (mobile/ios, `PlanCreateController`): the same list as the site's city
 * box (HotelCityInput). Built once at build time; the app keeps a copy.
 */
export const dynamic = "force-static";

export function GET() {
  const cities = COUNTRIES.flatMap((country) =>
    (COUNTRY_CITIES[country.code] ?? []).map((c) => ({
      code: country.code,
      slug: c.slug,
      ar: c.nameAr,
      en: c.nameEn,
      countryAr: country.nameAr,
      countryEn: country.nameEn,
    })),
  );
  return Response.json({ cities }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
