// Finds, for each of our cities and countries, the partner pages that really
// exist — an eSIM page for the country, an airport-transfer or car-rental page
// for the city — and stores only those (src/data/partnerPages.json). The site
// links a traveller to a partner page only when this check found it: a link to
// a 404 or to the partner's home page instead of their city is a broken
// promise.
//
//   npx tsx scripts/partners/check-pages.ts
//
// Each partner's address pattern was checked by hand on 10 Oct 2026 (Airalo
// /turkey-esim, Kiwitaxi /en/turkey/istanbul, Welcome Pickups
// /istanbul/airport-transfer/, Localrent /en/turkey/istanbul/). A page counts
// as found when it answers 200, was not redirected away from the place, and
// names the place in its <title>. Runs on GitHub Actions
// (.github/workflows/partner-pages.yml); polite: one request at a time.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { COUNTRY_CITIES } from "@/lib/cities";
import { COUNTRIES } from "@/lib/countries";

const OUT = join(process.cwd(), "src/data/partnerPages.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Other English names a partner may use for a country or city. */
const COUNTRY_ALIASES: Record<string, string[]> = {
  CZ: ["czech-republic"],
  BA: ["bosnia-and-herzegovina"],
  MK: ["north-macedonia", "macedonia"],
  KR: ["south-korea", "korea"],
  US: ["united-states", "usa"],
  GB: ["united-kingdom", "uk"],
  AE: ["united-arab-emirates", "uae"],
  TR: ["turkey", "turkiye"],
};
const CITY_ALIASES: Record<string, string[]> = {
  makkah: ["mecca"],
  madinah: ["medina"],
  "abu-dhabi": ["abu-dhabi"],
};

type Found = { url: string };

async function exists(url: string, mustContain: string[], pathMustKeep: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SfrtnaLinkCheck/1.0; +https://sfrtna.com)",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status !== 200) return false;
    if (!new URL(res.url).pathname.toLowerCase().includes(pathMustKeep)) return false;
    const html = (await res.text()).slice(0, 200_000);
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").toLowerCase();
    return mustContain.some((w) => title.includes(w.toLowerCase()));
  } catch {
    return false;
  }
}

async function first(candidates: { url: string; keep: string }[], names: string[]): Promise<Found | null> {
  for (const c of candidates) {
    const ok = await exists(c.url, names, c.keep);
    await sleep(700);
    if (ok) return { url: c.url };
  }
  return null;
}

async function main() {
  const countries: Record<string, { airalo?: string }> = {};
  const cities: Record<string, { kiwitaxi?: string; welcomepickups?: string; localrent?: string }> = {};

  const used = new Set(Object.keys(COUNTRY_CITIES));
  for (const c of COUNTRIES.filter((x) => used.has(x.code))) {
    const slugs = [...new Set([slug(c.nameEn), ...(COUNTRY_ALIASES[c.code] ?? [])])];
    const names = [c.nameEn, ...(COUNTRY_ALIASES[c.code] ?? []).map((s) => s.replace(/-/g, " "))];
    const airalo = await first(
      slugs.map((s) => ({ url: `https://www.airalo.com/${s}-esim`, keep: `${s}-esim` })),
      names
    );
    countries[c.code] = airalo ? { airalo: airalo.url } : {};
    console.log(`${c.code} airalo: ${airalo?.url ?? "-"}`);
  }

  for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
    const country = COUNTRIES.find((x) => x.code === code);
    if (!country) continue;
    const cSlugs = [...new Set([slug(country.nameEn), ...(COUNTRY_ALIASES[code] ?? [])])];
    for (const city of list) {
      const sSlugs = [...new Set([slug(city.nameEn), ...(CITY_ALIASES[city.slug] ?? [])])];
      const names = [city.nameEn, ...(CITY_ALIASES[city.slug] ?? []).map((s) => s.replace(/-/g, " "))];
      const entry: (typeof cities)[string] = {};

      const kiwi = await first(
        cSlugs.flatMap((cs) => sSlugs.map((s) => ({ url: `https://kiwitaxi.com/en/${cs}/${s}`, keep: `/${s}` }))),
        names
      );
      if (kiwi) entry.kiwitaxi = kiwi.url;

      const wp = await first(
        sSlugs.map((s) => ({ url: `https://www.welcomepickups.com/${s}/airport-transfer/`, keep: `/${s}/` })),
        names
      );
      if (wp) entry.welcomepickups = wp.url;

      const lr = await first(
        cSlugs.flatMap((cs) => sSlugs.map((s) => ({ url: `https://localrent.com/en/${cs}/${s}/`, keep: `/${s}` }))),
        names
      );
      if (lr) entry.localrent = lr.url;

      cities[city.slug] = entry;
      console.log(`${city.slug}: ${Object.keys(entry).join(", ") || "-"}`);
    }
  }

  const sorted = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(
    OUT,
    JSON.stringify({ checked: new Date().toISOString().slice(0, 10), countries: sorted(countries), cities: sorted(cities) }, null, 1) + "\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
