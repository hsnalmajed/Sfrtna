/**
 * Agoda hotel names → the hotel-name search (run by agoda-data.yml after
 * build-bundle.py): every hotel of out/city/<slug>.json filed under each
 * non-generic word of its English and Arabic names, as the same StoredHotel
 * rows the OpenStreetMap index uses, in out/words/<key>.json.
 *
 * Key = the word's first THREE letters (two for a two-letter word), as code
 * points — narrower than hotel-words' two, because Agoda has ~446k hotels.
 * Read by src/lib/providers/localHotels.ts (agodaWordKey).
 *
 *   npx --yes tsx@4 scripts/agoda/build-words.ts <out>
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { indexWords, type StoredHotel } from "../../src/lib/hotelIndex";
import { agodaWordKey } from "../../src/lib/agodaWords";

const out = process.argv[2];
const shards = new Map<string, StoredHotel[]>();
let hotels = 0;
for (const file of readdirSync(`${out}/city`)) {
  const slug = file.replace(/\.json$/, "");
  const rows = JSON.parse(readFileSync(`${out}/city/${file}`, "utf8")) as [number, string, string, number][];
  for (const [, name, nameAr, stars] of rows) {
    hotels++;
    const row: StoredHotel = [slug, name, nameAr || "", Math.round(stars) || 0, ""];
    for (const w of indexWords(name, nameAr || "")) {
      const key = agodaWordKey(w);
      if (!key) continue;
      const list = shards.get(key) ?? [];
      list.push(row);
      shards.set(key, list);
    }
  }
}
mkdirSync(`${out}/words`, { recursive: true });
let biggest = 0;
for (const [key, list] of shards) {
  const text = JSON.stringify(list);
  biggest = Math.max(biggest, text.length);
  writeFileSync(`${out}/words/${key}.json`, text);
}
console.log(`AGODA words: ${hotels} hotels, ${shards.size} files, biggest ${(biggest / 1e6).toFixed(1)} MB`);
