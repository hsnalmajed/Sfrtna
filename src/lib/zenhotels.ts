import { COUNTRY_CITIES } from "@/lib/cities";
import { COUNTRIES } from "@/lib/countries";
import { searchEquals } from "@/lib/search";

/**
 * ZenHotels — the consumer site of RateHawk (Emerging Travel Group), which is
 * where RateHawk's affiliate links land.
 *
 * Its search takes a numeric region id, not a city name, but it also serves a
 * page per city at /hotel/<country>/<city>/ and resolves that to the region
 * itself, keeping every query parameter we add — including the partner tags.
 * So a city we know by name can be linked without a region lookup.
 *
 * The paths below were checked one by one against zenhotels.com on
 * 2 Oct 2026: 186 of our cities answer at the slug of their English names,
 * the overrides are cities ZenHotels files under a different name, and the
 * skipped ones had no page we could confirm. A city without a confirmed page
 * gets no ZenHotels button rather than a link to a 404.
 *
 * The partner tags are what the RateHawk link generator issues for our
 * account; they ride in the visible URL and are not secrets.
 */
const PARTNER_SLUG = "100351830.affiliate.1639";

const OVERRIDES: Record<string, string> = {
  AlUla: "saudi_arabia/al_ula",
  Cappadocia: "turkey/goreme",
  Marrakesh: "morocco/marrakech",
  Fez: "morocco/fes",
  Santorini: "greece/santorini_island",
  Malacca: "malaysia/melaka",
  "Xi'an": "china/xian",
  "New York City": "united_states_of_america/new_york",
  "Los Angeles": "united_states_of_america/los_angeles",
  "Las Vegas": "united_states_of_america/las_vegas",
  "San Francisco": "united_states_of_america/san_francisco",
  Miami: "united_states_of_america/miami",
  Stepantsminda: "georgia/kazbegi",
  "Saint Petersburg": "russia/st._petersburg",
  Prague: "czech_republic/prague",
  "Karlovy Vary": "czech_republic/karlovy_vary",
  Tromsø: "norway/tromso",
  "Cebu City": "philippines/cebu",
  Zanzibar: "tanzania/stone_town",
  "Grand Baie": "mauritius/grand_bay",
  Mahé: "seychelles/mahe_island",
};

/** No confirmed city page on ZenHotels. */
const SKIP = new Set(["Oxford", "Bali", "Singapore", "Da Nang", "Gold Coast", "Djerba", "Baalbek"]);

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** ZenHotels' path for a city named in Arabic or English, if we confirmed one. */
export function zenhotelsCityPath(name: string): string | null {
  for (const [code, cities] of Object.entries(COUNTRY_CITIES)) {
    const city = cities.find((c) => searchEquals(c.nameEn, name) || searchEquals(c.nameAr, name));
    if (!city) continue;
    if (SKIP.has(city.nameEn)) return null;
    if (OVERRIDES[city.nameEn]) return OVERRIDES[city.nameEn];
    const country = COUNTRIES.find((c) => c.code === code);
    return country ? `${slug(country.nameEn)}/${slug(city.nameEn)}` : null;
  }
  return null;
}

/** dd.mm.yyyy, the shape ZenHotels' `dates` parameter takes. */
function zenDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function zenhotelsCityUrl(opts: {
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  locale: "ar" | "en";
}): string | null {
  const path = zenhotelsCityPath(opts.city);
  if (!path) return null;
  const u = new URL(`https://www.zenhotels.com/hotel/${path}/`);
  u.searchParams.set("cur", "SAR");
  u.searchParams.set("dates", `${zenDate(opts.checkIn)}-${zenDate(opts.checkOut)}`);
  // One room: adults, then each child's age, joined by "and" (2and7 = two
  // adults and a seven-year-old), as the link generator writes it.
  u.searchParams.set("guests", [Math.max(1, opts.adults), ...opts.childrenAges].join("and"));
  u.searchParams.set("lang", opts.locale);
  u.searchParams.set("partner_extra", "sfrtna");
  u.searchParams.set("partner_slug", PARTNER_SLUG);
  u.searchParams.set("utm_medium", "api2");
  u.searchParams.set("utm_source", PARTNER_SLUG);
  return u.toString();
}
