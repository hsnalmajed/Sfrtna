// Builds the files the hotel-name search reads from the collected city lists
// (scripts/hotels/cities/*.json, written by fetch-hotels.ts):
//
//   public/data/hotels/<slug>.json       the city's best HOTELS_PER_CITY_FILE hotels
//   public/data/hotel-words/<key>.json   every hotel, under each word of its names
//
//   npx tsx scripts/hotels/build-index.ts
//
// Only the word cutting in src/lib/hotelIndex.ts shapes these files; the
// Arabic dictionary is applied when searching, so changing it needs no rebuild.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOTELS_PER_CITY_FILE, indexWords, shardKey, type StoredHotel } from "@/lib/hotelIndex";

const SRC = join(process.cwd(), "scripts/hotels/cities");
const CITY_OUT = join(process.cwd(), "public/data/hotels");
const WORD_OUT = join(process.cwd(), "public/data/hotel-words");

type Raw = [string, string, string, number, number];

// Mapped as a hotel but named as a restaurant or café («مطعم سلام بالاس»):
// left out, unless the name also says it is a place to stay ("Patio Hotel &
// Restaurant" stays).
const EATERY = /restaurant|restoran|ristorante|\bcaf[eé]\b|coffee|مطعم|مقهى|كافيه|كوفي/i;
const STAY = /hotel|otel|\binn\b|suite|rooms?\b|guest|pansiyon|pension|hostel|dorm|resort|lodge|villa|apart|motel|فندق|شقق|اجنح|أجنح|نزل|منتجع|سكن|استراح/i;
const notAHotel = (names: string[]) => names.some((n) => EATERY.test(n)) && !names.some((n) => STAY.test(n));

function main() {
  if (!existsSync(SRC)) {
    console.log("no collected hotels yet");
    return;
  }
  for (const dir of [CITY_OUT, WORD_OUT]) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  const shards = new Map<string, StoredHotel[]>();
  let hotels = 0;
  for (const file of readdirSync(SRC).filter((f) => f.endsWith(".json")).sort()) {
    const slug = file.replace(/\.json$/, "");
    const raw = JSON.parse(readFileSync(join(SRC, file), "utf8")) as Raw[];
    const stored: StoredHotel[] = raw.filter((r) => !notAHotel([r[0], r[1], r[2]])).map(([name, en, ar, stars]) => {
      const arabicName = /[؀-ۿ]/.test(name);
      // Booking sites and the price search know a hotel by its Latin name.
      const shown = en || name;
      const nameAr = ar || (arabicName ? name : "");
      const other = shown !== name && name !== nameAr ? name : "";
      return [slug, shown, nameAr === shown ? "" : nameAr, stars, other];
    });
    writeFileSync(join(CITY_OUT, file), JSON.stringify(stored.slice(0, HOTELS_PER_CITY_FILE)));
    for (const h of stored) {
      const keys = new Set<string>();
      for (const w of indexWords(h[1], h[2], h[4])) {
        const k = shardKey(w);
        if (k) keys.add(k);
      }
      for (const k of keys) {
        const list = shards.get(k) ?? [];
        list.push(h);
        shards.set(k, list);
      }
    }
    hotels += stored.length;
  }
  let biggest = 0;
  for (const [k, list] of shards) {
    // Best first, so a word shared by thousands still shows the likeliest.
    list.sort((a, b) => b[3] - a[3]);
    biggest = Math.max(biggest, list.length);
    writeFileSync(join(WORD_OUT, `${k}.json`), JSON.stringify(list));
  }
  console.log(`${hotels} hotels, ${shards.size} word files, largest ${biggest}`);
}

main();
