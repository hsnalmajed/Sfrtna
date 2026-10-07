// Chooses a Pexels photo for every place the site shows a picture of, and
// stores the choices in src/data/pexelsPhotos.json. Pages read that file;
// they never call Pexels themselves (see the top of src/lib/pexels.ts).
//
//   PEXELS_API_KEY=… npx tsx scripts/pexels-photos.ts [--max 180] [--list]
//
// --list   only count the subjects and how many are still missing.
// --max N  at most N searches this run (default 180, under Pexels' hourly
//          allowance of 200). The run is resumable: GitHub Actions
//          (.github/workflows/photos.yml) runs it every hour until nothing is
//          missing, then each run finds nothing to do and spends nothing.
//
// The list of subjects comes from the site's own code — the same functions
// the pages call, run with a collector switched on — so a city added to the
// data gets a photo on the next run without anyone listing it here.
//
// A search that fails (no network, allowance used up) stops the run and
// records nothing for that subject, so it is tried again next time. A
// subject where every search worked but no caption named the place is
// stored as an empty list: its card keeps the navy tile, and it is not
// searched again. Up to three photos are kept per place (one search returns
// fifteen, so this costs nothing extra); the page shows a different one
// each week.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COUNTRIES } from "@/lib/countries";
import { COUNTRY_CITIES } from "@/lib/cities";
import { DESTINATIONS } from "@/lib/destinations";
import { placeForDestination } from "@/lib/destinationPlace";
import { fetchCountryPhotos, fetchCityPhotos } from "@/lib/countryPhotos";
import { fetchCityOverviews } from "@/lib/mapPins";
import { fetchCityHighlights } from "@/lib/guideHighlights";
import {
  rawSearch,
  startCollectingSubjects,
  stopCollectingSubjects,
  PHOTOS_PER_PLACE,
  type StoredPhoto,
  type StoredPhotoRec,
} from "@/lib/pexels";

const FILE = join(process.cwd(), "src/data/pexelsPhotos.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function subjects() {
  const found = startCollectingSubjects();

  await fetchCountryPhotos(COUNTRIES.map((c) => c.code));

  const cities = Object.entries(COUNTRY_CITIES).flatMap(([code, list]) =>
    list.map((c) => ({ code, slug: c.slug, nameEn: c.nameEn }))
  );
  const destinationCities = DESTINATIONS.map((d) => placeForDestination(d.code, d.nameEn, 1))
    .filter((p) => p !== undefined)
    .map((p) => ({ code: p.countryCode, slug: p.citySlug, nameEn: p.cityNameEn }));
  await fetchCityPhotos([...cities, ...destinationCities]);

  for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
    await fetchCityOverviews(list);
    for (const city of list) await fetchCityHighlights(code, city);
  }

  stopCollectingSubjects();
  return found;
}

async function main() {
  const wanted = await subjects();
  const stored: Record<string, StoredPhoto> = JSON.parse(readFileSync(FILE, "utf8"));
  const missing = [...wanted.entries()].filter(([k]) => !(k in stored));

  const withPhoto = Object.values(stored).filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))).length;
  console.log(`subjects ${wanted.size} · stored ${Object.keys(stored).length} (${withPhoto} with a photo) · missing ${missing.length}`);
  if (process.argv.includes("--list") || missing.length === 0) return;

  if (!process.env.PEXELS_API_KEY) {
    console.log("PEXELS_API_KEY is not set — nothing searched.");
    return;
  }

  let budget = Number(arg("--max") ?? 180);
  let added = 0;
  let stoppedBy: string | null = null;

  outer: for (const [k, queries] of missing) {
    // The searches in order (landmark, city, country) until three photos
    // whose captions name the place are found, or the searches run out.
    const found: StoredPhotoRec[] = [];
    for (const q of queries) {
      if (found.length >= PHOTOS_PER_PLACE) break;
      if (budget <= 0) {
        stoppedBy = "budget";
        // Keep what was found for this place only if it is complete enough
        // to stand; otherwise it is searched again next run.
        if (found.length === 0) break outer;
        break;
      }
      budget--;
      const r = await rawSearch(q);
      if (r === null) {
        stoppedBy = "a failed search (allowance used up, or Pexels unreachable)";
        break outer;
      }
      for (const p of r.photos) {
        const original = p.url.split("?")[0];
        if (found.some((f) => f.o === original)) continue;
        found.push({ o: original, n: p.photographer, nu: p.photographerUrl, u: p.pageUrl });
        if (found.length >= PHOTOS_PER_PLACE) break;
      }
    }
    stored[k] = found;
    added++;
    if (stoppedBy === "budget") break;
  }

  // Sorted, one subject per line: small, readable diffs in git.
  const sorted = Object.fromEntries(Object.entries(stored).sort(([a], [b]) => a.localeCompare(b)));
  const lines = Object.entries(sorted).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  writeFileSync(FILE, `{\n${lines.join(",\n")}\n}\n`);

  const left = missing.length - added;
  console.log(`added ${added} · still missing ${left}${stoppedBy ? ` · stopped by ${stoppedBy}` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
