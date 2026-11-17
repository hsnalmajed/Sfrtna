// A city's guide must not list the place the traveller is already in:
// the country (Ella → «Sri Lanka»), the city or region itself (Langkawi →
// «Langkawi»), or the island the city is on, named after it (Hong Kong →
// «Hong Kong Island»). Spot-check of 18 Nov 2026 found these at the top of
// three plans, as day stops.
import { CITY_COORDS } from "@/data/cityCoords";
import { COUNTRIES } from "@/lib/countries";
import { COUNTRY_CITIES } from "@/lib/cities";
import type { GuidePlace } from "@/lib/guideTypes";
import { CITY_NAMES_EN } from "./cityNames";

const norm = (s: string | undefined) => (s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z؀-ۿ]+/g, " ").trim();
const AREA_KINDS = new Set(["island", "region", "archipelago"]);

export function isTheAreaItself(p: Pick<GuidePlace, "n" | "e" | "a" | "kd" | "sl">, slug: string): boolean {
  const code = CITY_COORDS[slug]?.code;
  const country = COUNTRIES.find((c) => c.code === code);
  const city = code ? COUNTRY_CITIES[code]?.find((c) => c.slug === slug) : undefined;
  const cityEn = norm(CITY_NAMES_EN[slug] ?? city?.nameEn);
  const own = [norm(p.e), norm(p.n), norm(p.a)].filter(Boolean);
  // The country, whatever its kind (Wikidata calls Sri Lanka an island).
  const countries = new Set([norm(country?.nameEn), norm(country?.nameAr)].filter(Boolean));
  if (own.some((n) => countries.has(n))) return true;
  // The city's own island or region. A sight the city is named after stays
  // (Victoria Falls, Punta Cana beach): only area kinds are dropped.
  // An islet that is a sight (Bled Island 8 articles, Malacca Island 9) is
  // smaller news than the island a city stands on (Penang 36, Jeju 81).
  if (!AREA_KINDS.has(p.kd ?? "") || p.sl < 15) return false;
  const names = [cityEn, norm(city?.nameEn), norm(city?.nameAr)].filter((n) => n.length > 2);
  const same = new Set(names.flatMap((c) => [c, `${c} island`, `${c} islands`, `island of ${c}`, `جزيرة ${c}`, `جزر ${c}`]));
  return own.some((n) => same.has(n));
}
